# Self-cached

Local file caching for self-hosted GitHub Actions runners. Made specifically for macOS runners using native virtual machines with attached host volumes.

- [x] Relative, absolute, and tilde path support. 
- [x] Multiple path caching support – cache several related paths in one step.
- [x] Default cache location via `SELF_CACHED_DIR` environment variable.
- [x] Configurable cache compression for fine-tuning the performance.
- [ ] Glob support – not sure how it would work, but sounds useful…

## 💡 Usage
This is mostly inspired by the old-good [actions/cache](https://github.com/actions/cache) action – check it out first if you're not familiar with the concepts.

Here's an example of `.github/workflows/main.yml` using this action to cache different dependencies:

```yaml
# Can be set up globally for all jobs…
# env:
#   SELF_CACHED_DIR: /Volumes/My Shared Files/cache

jobs:
  main:
    env:
      # Optional cache dir to use by all steps in this job.
      SELF_CACHED_DIR: /Volumes/My Shared Files/cache
    
    steps:
        
      # 📦 Cache steps

      # Both relative and absolute paths are supported.
      - name: SPM cache
        uses: iby/self-cached@v1
        id: cache-spm
        with:
          key: spm-${{ hashFiles('App.xcworkspace/xcshareddata/swiftpm/Package.resolved') }}
          path: deps/SPM
          
      # Multiple paths can be cached in one step.
      - name: FFmpeg cache
        uses: iby/self-cached@v1
        id: cache-ffmpeg
        with:
          key: ffmpeg-${{ hashFiles('deps/FFmpeg/build.sh') }}
          path: |
            deps/FFmpeg/include
            deps/FFmpeg/lib

      # Tilde-path expansion is supported.
      - name: Mint cache
        uses: iby/self-cached@v1
        id: cache-mint
        with:
          key: mint-${{ hashFiles('Mintfile') }}
          path: ~/.mint
          
      # 🧩 Dependency steps – run only when no cache was restored…

      - name: Set up SPM
        if: steps.cache-spm.outputs.cache-hit != 'true'
        run: xcodebuild -workspace App.xcworkspace -scheme App -resolvePackageDependencies -clonedSourcePackagesDirPath deps/SPM

      - name: Set up FFmpeg
        if: steps.cache-ffmpeg.outputs.cache-hit != 'true'
        run: deps/FFmpeg/build.sh
          
      - name: Set up Mint
        if: steps.cache-mint.outputs.cache-hit != 'true' 
        run: mint bootstrap
```

## 📥 Inputs
- **`path` (required)**: Paths to cache, one per line.
- **`key` (required)**: Cache key identifier.
- **`dir` (optional)**: Cache directory. Defaults to `$SELF_CACHED_DIR` or `~/.self-cached`.

## 📤 Outputs
- **`cache-hit`:** `true` if cache was restored, `false` otherwise.

## 🤔 Why another cache action?
Fair question. I went through all the existing options, and they all fell short of what I wanted:
- No way to toggle compression — archiving huge file sets often slows down local caching.
- No tilde expansion support.
- Some don't handle multiple paths.
- Some silently skip restoring if the destination already exists.
- Most come with cluttered, overengineered configs.
- Many are just fork-copies with no meaningful differences.
- And plenty are classic vibe-coded “pearls” where the author forgot to check the code…
