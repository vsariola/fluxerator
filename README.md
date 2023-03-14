# fluxerator

A windows 4k intro by chlumpie & pestis, released at Revision 2023.

Source: https://github.com/vsariola/fluxerator

## Prerequisites for building

Rocket is included as a submodule in the repo, so you should clone it
with e.g.
`git clone --depth=1 --recursive https://github.com/vsariola/fluxerator`

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
   Light/medium/heavy refers to compression level, 720/1080/2160 the
   resolution. Debug versions are for development.
3. Build & run.

CMake should copy the exes into the dist/ folder.

## How to sync

When the compression is switched off (e.g. in one of the debug
configuration), you can build the sync target. Then:

1. Run this rocket server: https://github.com/emoon/rocket
2. Then run the sync.exe. Note that if you try to sync.exe before
   running the server, it just closes. So the server needs to be ran
   first.
3. With the server, open the data/syncs.rocket and start syncing. Then
   save your changes back to the XML.

If you need more sync tracks, just manually add a new empty track to the
syncs.rocket XML before building the `sync` target
(`<track name="mygroup#mytrackname"/>`). When building `sync` and
`intro`, the file will get processed and all executables will become
aware of the sync variable. The new track will appear as a const
variable in the shader. For a track named `mygroup#mytrackname`, a
constant `MYGROUP_MYTRACKNAME` will be available to the shader, and you
can access the variable with `syncs[MYGROUP_MYTRACKNAME]`. The `#`
grouping character is replaced with `_` and the string is made
uppercase.

Notice that when building the final intro, the sync key values are
stored as signed 8.8 fixed point, and as an optimization, all other
interpolation modes than step and linear were removed from the player.
Thus, never use values outside the range -128 <= x < 128, and never use
ramp & smooth interpolation modes (they are still working in some of the
older commits, before we removed them as unnecessary, if you need
those). Also, since the values are fixed point, only whole numbers are
exact, numbers with decimals will likely be slightly rounded. For
example, 1.01 will be represented by integer 259, which becomes ~ 1.012.

## What was learned this time

- DirectSound gives far better sync accuracy than mmsystem.h; there's
  annoying latency in mmsystem.h. Gargaj was kind enough to show how to
  use DirectSound. Primary buffers are not needed; DirectSound creates
  one automatically. Thus, setting up a buffer and playing sound is
  almost as little bytes as using mmsystem.h. In 2023, no-one who cares
  about sync accuracy should use the old method.
- Glow: glow can be accumulated in the raymarcher map function with glow
  += a/(b+d*d), where a and b are constants and d is the SDF distance to
  object. The glow can be then later added to the pixel color with color
  += glow * glowcolor after the raymarcher is done.
- Rocket: Rocket is awesome, but to fit things in a 4k intro, the player
  had to be rewritten in x86 assembly. The player is approx. 100 bytes
  after compression, or since we didn't use any other interpolation than
  step and linear, with the rest of the interpolation modes removed, it
  was finally ~ 90 bytes. The sync data was splitted into streams of
  different types (keypoint values, key point duration in rows, key
  point interpolation mode and the starting keypoint for each track) and
  each stream was placed in its own section so that Crinkler can juggle
  them around. All sync data was compressed to little over 300 bytes in
  total.
- NvOptimusEnablement is still a thing in 2023: on the laptops own
  screen, without NvOptimusEnablement, the intro defaults to Intel
  integrated GPU. On an external monitor, my laptop always uses NVidia
  GPU. One can of course adjust this from NVidia control panel in a per
  program basis, but for convenience, we still squeezed in
  NvOptimusEnablement. ATI: Sucks to be you, can't even test if the
  intro works.
- Fizzer showed how to get text on screen, with the wglUseFontBitmaps &
  glCallLists method. Curiously, I had to adjust glListBase when using
  the text in windowed mode; dunno if it's a bug or if there's something
  I don't understand.

## License

[MIT](LICENSE)