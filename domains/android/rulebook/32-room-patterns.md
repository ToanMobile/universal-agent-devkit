# 32 — Room Patterns

## Architecture
```
Database → DAO → Repository → ViewModel → UI
```

## Database Setup
```kotlin
@Database(
    entities = [DocumentEntity::class, BookmarkEntity::class],
    version = 4,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun documentDao(): DocumentDao
    abstract fun bookmarkDao(): BookmarkDao
}
```

### Hilt Module
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "office-reader.db"
        ).build()
    }
    
    @Provides fun provideDocumentDao(db: AppDatabase) = db.documentDao()
    @Provides fun provideBookmarkDao(db: AppDatabase) = db.bookmarkDao()
}
```

---

## DAO Patterns

### Basic CRUD
```kotlin
@Dao
interface DocumentDao {
    
    @Query("SELECT * FROM documents ORDER BY lastModified DESC")
    fun getAllDocuments(): Flow<List<DocumentEntity>>
    
    @Query("SELECT * FROM documents WHERE id = :id")
    suspend fun getDocumentById(id: String): DocumentEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocument(document: DocumentEntity)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(documents: List<DocumentEntity>)
    
    @Delete
    suspend fun deleteDocument(document: DocumentEntity)
    
    @Query("DELETE FROM documents WHERE id = :id")
    suspend fun deleteById(id: String)
}
```

### Query Performance
```kotlin
// ✅ Index on frequently queried columns
@Entity(tableName = "documents", indices = [
    Index(value = ["lastModified"]),
    Index(value = ["name"]),
    Index(value = ["type"])
])

// ✅ Limit results
@Query("SELECT * FROM documents ORDER BY lastModified DESC LIMIT :limit")
fun getRecentDocuments(limit: Int): Flow<List<DocumentEntity>>

// ✅ Use @Transaction for consistency
@Transaction
suspend fun replaceAll(documents: List<DocumentEntity>) {
    deleteAll()
    insertAll(documents)
}
```

---

## Migrations

### Manual Migration
```kotlin
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE documents ADD COLUMN fileSize INTEGER NOT NULL DEFAULT 0")
    }
}

val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS bookmarks (...)")
    }
}

// In Database builder
Room.databaseBuilder(context, AppDatabase::class.java, "office-reader.db")
    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
    .build()
```

### Auto Migration (Room 2.4+)
```kotlin
@Database(
    version = 4,
    autoMigrations = [
        AutoMigration(from = 3, to = 4)
    ]
)
```

### Migration Testing
```kotlin
@Test
fun migrate1to2() {
    val db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
        .addMigrations(MIGRATION_1_2)
        .build()
    // Insert data at version 1, close, reopen at version 2
    db.close()
    // Verify data intact
}
```

## Transactions
```kotlin
// In DAO
@Transaction
suspend fun updateDocumentAndBookmarks(
    document: DocumentEntity,
    bookmarks: List<BookmarkEntity>
) {
    insertDocument(document)
    deleteBookmarksForDocument(document.id)
    insertAllBookmarks(bookmarks)
}

// In Repository
suspend fun atomicUpdate(document: DocumentEntity) {
    database.withTransaction {
        documentDao.insertDocument(document)
        // other operations...
    }
}
```

## TypeConverters
```kotlin
class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Date? = value?.let { Date(it) }
    
    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? = date?.time
    
    @TypeConverter
    fun fromStringList(value: String): List<String> = 
        if (value.isEmpty()) emptyList() else value.split(",")
    
    @TypeConverter
    fun toStringList(list: List<String>): String = list.joinToString(",")
}

// Register in Database
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase()
```

## Anti-Patterns
- ❌ Database/DAO queries on Main thread (use `Flow` or `suspend`).
- ❌ `@Query` returning `MutableLiveData` (use `Flow`).
- ❌ Missing indices on frequently filtered/sorted columns.
- ❌ `fallbackToDestructiveMigration()` in production (data loss!).
- ❌ Large transactions (blocks database for too long).
