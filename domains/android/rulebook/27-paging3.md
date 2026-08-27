# 27 — Paging 3

## When to Use Paging?
- Large datasets from local DB (Room).
- Network + local cache (RemoteMediator).
- Lists whose measured/query/network/memory behavior benefits from incremental loading.

## Architecture Overview
```
UI (LazyPagingItems) → ViewModel (Pager) → Repository (PagingSource / RemoteMediator)
```

---

## PagingSource — Custom Data Source

### Local Data (Room / File System)
```kotlin
class DocumentPagingSource(
    private val repository: DocumentRepository
) : PagingSource<Int, Document>() {
    
    override fun getRefreshKey(state: PagingState<Int, Document>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }
    
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Document> {
        return try {
            val page = params.key ?: 0
            val pageSize = params.loadSize
            val documents = repository.getDocuments(page, pageSize)
            LoadResult.Page(
                data = documents,
                prevKey = if (page > 0) page - 1 else null,
                nextKey = if (documents.size == pageSize) page + 1 else null
            )
        } catch (e: IOException) {
            LoadResult.Error(e)
        }
    }
}
```

### Room Built-in PagingSource
```kotlin
@Dao
interface DocumentDao {
    @Query("SELECT * FROM documents ORDER BY lastModified DESC")
    fun pagingSource(): PagingSource<Int, Document> // Room auto-generates
}
```

## Pager — ViewModel Layer
```kotlin
@HiltViewModel
class DocumentListViewModel @Inject constructor(
    private val repository: DocumentRepository
) : ViewModel() {
    
    val documents: Flow<PagingData<Document>> = Pager(
        config = PagingConfig(
            pageSize = 20,
            prefetchDistance = 5,
            enablePlaceholders = true,
            initialLoadSize = 40
        ),
        pagingSourceFactory = { DocumentPagingSource(repository) }
    ).flow.cachedIn(viewModelScope)
}
```

## UI Layer — LazyPagingItems
```kotlin
@Composable
fun DocumentList(viewModel: DocumentListViewModel) {
    val documents = viewModel.documents.collectAsLazyPagingItems()
    
    LazyColumn {
        items(
            count = documents.itemCount,
            key = documents.itemKey { it.id },
            contentType = documents.itemContentType { "document" }
        ) { index ->
            val document = documents[index]
            document?.let {
                DocumentCard(document, onClick = { /* navigate */ })
            }
        }
        
        // Load State handling
        when (val state = documents.loadState.refresh) {
            is LoadState.Error -> {
                item { ErrorItem(state.error, onRetry = { documents.retry() }) }
            }
            is LoadState.Loading -> {
                item { LoadingItem() }
            }
            is LoadState.NotLoading -> { /* no action */ }
        }
        
        // Append loading
        when (documents.loadState.append) {
            is LoadState.Loading -> {
                item { LoadingIndicator() }
            }
            is LoadState.Error -> {
                item { RetryButton(onClick = { documents.retry() }) }
            }
            is LoadState.NotLoading -> { /* no action */ }
        }
    }
}
```

### 3 LoadState Types
| State | When |
|:---|:---|
| `refresh` | Initial load or `.refresh()` call |
| `append` | Loading next page |
| `prepend` | Loading previous page (rare) |

### Empty State
```kotlin
if (documents.loadState.refresh is LoadState.NotLoading && documents.itemCount == 0) {
    EmptyState(onBrowseFiles = { /* navigate */ })
}
```

## PagingConfig Best Practices
| Parameter | Recommended | Reason |
|:---|:---|:---|
| `pageSize` | 20 | Balance memory & network |
| `prefetchDistance` | `pageSize / 2` | Smooth scrolling |
| `enablePlaceholders` | `true` for Room, `false` for network | Placeholders need known count |
| `initialLoadSize` | `pageSize * 2` | Fill visible area faster |

## Refresh & Invalidation
```kotlin
// Invalidate to reload
fun refresh() {
    // When using PagingSource factory
    viewModelScope.launch {
        // Invalidate via new Pager or refresh
    }
}

// RemoteMediator refresh
pagingSource.invalidate()
```

## RemoteMediator — Network + Local Cache
```kotlin
@OptIn(ExperimentalPagingApi::class)
class DocumentRemoteMediator(
    private val remoteApi: DocumentApi,
    private val localDb: DocumentDao
) : RemoteMediator<Int, Document>() {
    
    override suspend fun load(
        loadType: LoadType,
        state: PagingState<Int, Document>
    ): MediatorResult {
        return try {
            val page = when (loadType) {
                LoadType.REFRESH -> 0
                LoadType.PREPEND -> return MediatorResult.Success(endOfPaginationReached = true)
                LoadType.APPEND -> {
                    val lastItem = state.lastItemOrNull()
                        ?: return MediatorResult.Success(endOfPaginationReached = true)
                    lastItem.page + 1
                }
            }
            
            val response = remoteApi.getDocuments(page, state.config.pageSize)
            localDb.insertAll(response.documents)
            
            MediatorResult.Success(endOfPaginationReached = response.documents.isEmpty())
        } catch (e: IOException) {
            MediatorResult.Error(e)
        }
    }
}
```

### ViewModel Setup
```kotlin
val documents: Flow<PagingData<Document>> = Pager(
    config = PagingConfig(pageSize = 20),
    remoteMediator = DocumentRemoteMediator(api, dao),
    pagingSourceFactory = { dao.pagingSource() }
).flow.cachedIn(viewModelScope)
```

### When to Use RemoteMediator?
- Data from network, cached locally.
- Need offline-first behavior.
- Single source of truth in Room.

## Anti-Patterns
- ❌ Page/prefetch size chosen without viewport, item cost, backend contract or measurement evidence.
- ❌ Missing `key` in LazyColumn when using `LazyPagingItems`.
- ❌ Ignoring `LoadState.Error` → silent failures.
- ❌ `RemoteMediator` without local cache (use plain PagingSource for network-only).
