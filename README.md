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

## How to sync

When the compression is switched off (e.g. in one of the debug
configuration), you can build the sync target. Then:

1. Run this rocket server: https://github.com/emoon/rocket
2. Then run the sync.exe. Note that if you try to sync.exe before
   running the server, it just silently closes. So the server needs to
   be ran first.
3. With the server, open the data/syncs.rocket and start syncing. Then
   save your changes back to the XML.

If you need more sync tracks, just add them manually to the syncs.rocket
XML before building sync. The file should be processed during building
and all executables should become aware of the new number of syncs
needed. Also, the sync tracks should appear as defines in the shader, so
if you define a track named `cam#x`, a constant `CAM_X` will be
available to the shader, and you can access the variable with `syncs[CAM_X]`.
`#` are replaced with `_` and the string is made uppercase.

Notice that the sync key values are stored as signed 8.8 fixed point.
Thus, never use values outside the range -128 <= x < 128. Also, since
the values are fixed point, only whole numbers are exact, numbers with
decimals will likely be slightly rounded. For example, 1.01 will be
represented by integer 259, which becomes ~ 1.012.

## License

[MIT](LICENSE)