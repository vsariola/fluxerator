cmake_minimum_required(VERSION 3.10)

cmake_policy(SET CMP0091 NEW)

set(CMAKE_VERBOSE_MAKEFILE ON)

project(eightkay-someday
    VERSION 0.0.0
    DESCRIPTION "A base for making a 8k intro... someday"
    LANGUAGES C CXX)

# Only do these if this is the main project, and not if it is included through add_subdirectory
if(CMAKE_PROJECT_NAME STREQUAL PROJECT_NAME)
    # Let's ensure -std=c++xx instead of -std=g++xx
    set(CMAKE_CXX_EXTENSIONS OFF)

    # Let's nicely support folders in IDE's
    set_property(GLOBAL PROPERTY USE_FOLDERS ON)
endif()

file(GLOB RKT_SYNC_SRCS
	${CMAKE_CURRENT_SOURCE_DIR}/extern/rocket/lib/*.c
)
add_library(rkt_sync ${RKT_SYNC_SRCS})
target_include_directories(rkt_sync PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/extern/rocket/lib)
set(RKT_PROJECT_INCLUDES ${RKT_PROJECT_INCLUDES} ${CMAKE_CURRENT_SOURCE_DIR}/extern/rocket/lib)

# tell nasm that we want 32-bit OBJ file

if("${CMAKE_SIZEOF_VOID_P}" STREQUAL "4")
    set(CMAKE_ASM_NASM_OBJECT_FORMAT win32)
    enable_language(ASM_NASM)
    # remove flags from nasm as the same compile flags were causing trouble
    set(CMAKE_ASM_NASM_COMPILE_OBJECT "<CMAKE_ASM_NASM_COMPILER> <INCLUDES> <DEFINES> -f ${CMAKE_ASM_NASM_OBJECT_FORMAT} -o <OBJECT> <SOURCE>")
    add_subdirectory(src)
endif()

