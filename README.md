# still unnamed 8k intro

## Prerequisites for building

Following tools should be in path:

1. [nasm](https://www.nasm.us/)
2. [Python 3](https://www.python.org/)
3. [Shader-minifier](https://github.com/laurentlb/Shader_Minifier)
4. [Crinkler](https://github.com/runestubbe/Crinkler) Note: As crinkler.exe, not link.exe
5. Optionally: [glslangValidator](https://github.com/KhronosGroup/glslang)

So far, building has been tested with Visual Studio 2022. Make sure you
also installed [CMake](https://cmake.org/) with it as the build was
automated with CMake.

## Build

1. Open the repository folder using Visual Studio
2. Choose the configuration (heavy-1080 is the compo version).
   Medium/heavy refers to compression level, 720/1080/2160 the
   resolution. Debug versions are for development.
3. Build & run.

CMake should copy the exes into the dist/ folder.

## License

[MIT](LICENSE)