import argparse
import os
import glob
import sys
import struct
from xml.dom import minidom


def main():
    """Main entrypoint for the command line program"""

    argparser = argparse.ArgumentParser(
        prog='convert', description=f'Convert .rocket xml file into binary files')
    argparser.add_argument('rocket', help='input rocket file')
    argparser.add_argument('shader', help='input shader frag file')
    argparser.add_argument('instruments', help='number of instruments', type=int)
    argparser.add_argument('-o', '--output', default=os.getcwd(), metavar='str', help='output directory')

    args = argparser.parse_args()

    if not os.path.isdir(args.output):
        sys.exit('Output must be a directory.')

    outinc = os.path.join(args.output, "minirocket.inc")
    outheader = os.path.join(args.output, "minirocket.h")
    outshader = os.path.join(args.output, "shader_sync.frag")
    outtracknames = os.path.join(args.output, "minirocket_tracknames.h")

    file = minidom.parse(args.rocket)

    tracks = file.getElementsByTagName('tracks')[0]

    start_row = int(tracks.attributes['startRow'].value)
    end_row = int(tracks.attributes['endRow'].value)
    track = tracks.getElementsByTagName('track')
    starts = []
    rowtimes = []
    values = []
    types = []
    tracknames = []
    defines = dict()
    curstart = 0
    defines['ROW'] = '0'
    for i, t in enumerate(track):
        k = [(row, float(k.attributes['value'].value), int(k.attributes['interpolation'].value))
             for k in t.getElementsByTagName('key') if start_row <= (row := int(k.attributes['row'].value)) <= end_row]
        k.sort(key=lambda k: k[0])
        if len(k) == 0:
            k = [(start_row, 0, 0)]
        if k[0][0] > start_row:
            k = [(start_row, k[0][1], 0)] + k
        if k[-1][0] < end_row:
            k = k + [(end_row, k[-1][1], 0)]
        trackname = str(t.attributes['name'].value)
        tracknames.append(trackname)
        defines[trackname.upper().replace('#', '_')] = str(i+1)
        starts += [curstart]
        curstart += len(k)
        rowtimes += [[(k[i+1][0] - k[i][0]) if i < len(k)-1 else 65535 for i, _ in enumerate(k)]]
        def tofixed(x): return min(max(round(x*256), -32768), 32767)
        for e in k:
            f = e[1]*256
            if f < -32768 or f > 32767:
                print(f"Warning: keyframe value {e[1]} as 8.8 fixed point will be clamped to {f}")
        values += [[tofixed(e[1]) for e in k]]
        types += [[e[2] for e in k]]
    for i in range(args.instruments):
        defines[f'ENV_{i}'] = str(len(defines))    
    num_syncs = 1 + len(track) + args.instruments

    with open(outinc, 'w') as file:
        file.write(f'numtracks equ {len(track)}\n' +
                   ''.join(r'%define ' + k + ' ' + v + '\n' for k, v in defines.items()) +
                   f'\n' +
                   f'track_data:\n' +
                   f'    dw {",".join(str(v) for v in starts)}\n' +
                   f'\n' +
                   f'row_data:\n' +
                   ''.join('    dw ' + ','.join(str(v) for v in t) + '\n' for t in rowtimes) +
                   f'\n' +
                   f'value_data:\n' +
                   ''.join('    dw ' + ','.join(str(v) for v in t) + '\n' for t in values) +
                   f'\n' +
                   f'type_data:\n' +
                   ''.join('    db ' + ','.join(str(v) for v in t) + '\n' for t in types))

    with open(outheader, 'w') as file:
        file.write('#ifndef MINIROCKET_H_\n' +
                   '#define MINIROCKET_H_\n' +
                   '\n' +
                   '#define NUM_TRACKS ' + str(len(track)) + '\n' +
                   '#define NUM_INSTR ' + str(args.instruments) + '\n' +
                   '#define NUM_SYNCS ' + str(num_syncs) + '\n' +
                   '\n' +
                   '#ifdef __cplusplus\n' +
                   'extern "C" {\n' +
                   '#endif\n' +
                   '\n' +
                   'void __stdcall minirocket_sync(float,void*);\n' +
                   '\n' +
                   '#ifdef __cplusplus\n' +
                   '}\n' +
                   '#endif\n' +
                   '\n' +
                   '#endif\n')

    with open(outshader, 'w') as outfile:
        with open(args.shader, 'r') as file:
            code = file.read().split("\n")
            line = next((i for i, v in enumerate(code) if v.strip().startswith("// SYNCS")), None)
            if line is None:
                print("error: no line starting with // SYNCS found in the shader")
                sys.exit(1)
            code[line] = ''.join('const int ' + k + ' = ' + v + ';\n' for k, v in defines.items()) + \
                "const int NUM_TRACKS = " + str(len(track)) + ";\n" + \
                "const int NUM_INSTR = " + str(args.instruments) + ";\n" + \
                "const int NUM_SYNCS = " + str(num_syncs) + ";\n"
            strcode = '\n'.join(code)
            outfile.write(strcode)

    with open(outtracknames, 'w') as file:
        file.write('static const char* s_trackNames[] = {\n' +
                   '    ' + ''.join(f'"{t}", ' for t in tracknames) + '\n' +
                   '};\n')
        file.write('#define NUM_TRACKS ' + str(len(track)) + '\n')
        file.write('#define NUM_INSTR ' + str(args.instruments) + '\n')
        file.write('#define NUM_SYNCS ' + str(num_syncs) + '\n')


if __name__ == '__main__':
    main()
