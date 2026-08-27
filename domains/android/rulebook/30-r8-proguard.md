# 30 — R8 / ProGuard

## Release Build Setup
```kotlin
// app/build.gradle.kts
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

---

## Required Keep Rules

### Hilt — Keep Generated Components
```proguard
# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }
```

### Kotlin Serialization
```proguard
# Kotlin Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
```

### Gson (if used)
```proguard
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
```

### Room Database
```proguard
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**
```

### Compose
```proguard
# Compose — keep @Composable metadata
-keep class androidx.compose.** { *; }

# Keep stability annotations
-keep @interface androidx.compose.runtime.Stable
-keep @interface androidx.compose.runtime.Immutable
```

### Security Crypto
```proguard
-keep class androidx.security.crypto.** { *; }
```

### Retrofit / OkHttp (if used)
```proguard
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
```

### Coil Image Loading
```proguard
-keep class coil.** { *; }
```

### Data Models — Keep All
```proguard
# Keep all data models — needed for serialization
-keep class com.example.app.**.model.** { *; }
-keep class com.example.app.**.entity.** { *; }

# Keep enum values (needed for serialization + when expressions)
-keepclassmembers enum * { public static **[] values(); public static ** valueOf(java.lang.String); }
```

## R8 Full Mode (Aggressive Optimization)
```proguard
# Enable R8 full mode (in gradle.properties)
android.enableR8.fullMode=true
```

### R8 Full Mode Notes
- Requires `@Keep` annotations on reflection-accessed classes.
- Test thoroughly after enabling.
- Check obfuscation mapping for missing methods.

---

## Build & Verify

### Mapping File
```bash
# Mapping file location: app/build/outputs/mapping/release/mapping.txt
# Save with every release build for crash deobfuscation

# Check obfuscated class names (deobfuscate crash stack traces)
# ./gradlew :app:minifyReleaseWithR8

# Print mapping (class/method rename mapping)
# cat mapping.txt | head -50

# Check for missing keep rules
# ./gradlew :app:assembleRelease
# If R8 warnings → add keep rules

# Install and test on device
# ./gradlew :app:installRelease
```

## Release Build Checklist
- [ ] `minifyEnabled = true`, `shrinkResources = true`.
- [ ] All libraries have keep rules.
- [ ] All data models kept.
- [ ] Enum `values()` and `valueOf()` kept.
- [ ] `@Serializable` classes not obfuscated.
- [ ] Test release build on device.
- [ ] Mapping file archived.
- [ ] Crashlytics deobfuscation configured.

## Anti-Patterns
- ❌ `-keep class ** { *; }` (keep everything → defeats obfuscation).
- ❌ Releasing without testing obfuscated build.
- ❌ Not saving mapping file for each release.
- ❌ Full mode without `@Keep` annotations on reflection-accessed code.
