option(WINDOW "Define WINDOW macro, showing the intro in a small window instead of full screen" OFF)
option(OPENGL_DEBUG "Show OpenGL errors in a message box" OFF)
option(VALIDATE_SHADERS "Validate shaders using glslangValidator" ON)
set(COMPRESS_LEVEL "medium" CACHE STRING "Crinkler compression level: off, light, medium, heavy")
set_property(CACHE COMPRESS_LEVEL PROPERTY STRINGS OFF LIGHT MEDIUM HEAVY)
if (NOT XRES)
    set(XRES 1920)
endif()
if (NOT YRES)
    set(YRES 1080)
endif()
 
message(STATUS "Configuration options (configure with cmake -D...): WINDOW=${WINDOW} OPENGL_DEBUG=${OPENGL_DEBUG} VALIDATE_SHADERS=${VALIDATE_SHADERS} COMPRESS_LEVEL=${COMPRESS_LEVEL} XRES=${XRES} YRES=${YRES}")

find_program(PYTHON NAMES python python3)
if(NOT PYTHON)
  message(FATAL_ERROR "Python not found. Get Python from: https://www.python.org/")
else()
  message(STATUS "Python found at: ${PYTHON}")
endif()

find_program(SHADER_MINIFIER NAMES shader_minifier)
if(NOT SHADER_MINIFIER)
  message(FATAL_ERROR "shader_minifier not found. Get shader_minifier from: https://github.com/laurentlb/Shader_Minifier")
else()
  message(STATUS "shader_minifier found at: ${SHADER_MINIFIER}")
endif()

# Generate the minified inlined shaders        

set(SHADER_FRAG ../data/shader.frag)    
set(SHADER_CONFIGURED_FRAG shader_configured.frag)    
set(SHADER_SYNC_FRAG shader_sync.frag)    
set(SHADER_MINIFIED_INL shader.inl)    
configure_file(
    ${SHADER_FRAG}
    ${SHADER_CONFIGURED_FRAG}
)    
add_custom_command(
    OUTPUT ${SHADER_MINIFIED_INL}
    COMMAND ${SHADER_MINIFIER} -o ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_MINIFIED_INL} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_SYNC_FRAG}
    DEPENDS ${SHADER_SYNC_FRAG}
)    
set(SHADERS ${SHADER_MINIFIED_INL})
set(SHADER_INCLUDE_DIR ${CMAKE_CURRENT_BINARY_DIR})    

set(SYNCS_ROCKET data/syncs.rocket)    
set(ROCKET_OUTPUT minirocket.h minirocket.inc ${SHADER_SYNC_FRAG} minirocket_tracknames.h)    
add_custom_command(
    OUTPUT ${ROCKET_OUTPUT}
    COMMAND ${PYTHON} ${PROJECT_SOURCE_DIR}/data/convert.py -o ${CMAKE_CURRENT_BINARY_DIR} ${PROJECT_SOURCE_DIR}/${SYNCS_ROCKET} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_CONFIGURED_FRAG} 16
    DEPENDS ${PROJECT_SOURCE_DIR}/${SYNCS_ROCKET} ${SHADER_CONFIGURED_FRAG}
)    

# intro

set(exesuffix "")
if (NOT YRES EQUAL "1080")
    set(exesuffix "${exesuffix}-${YRES}")
endif()
if (WINDOW)
    set(exesuffix "${exesuffix}-window")
    message("Defining WINDOW macro")
    add_compile_definitions(WINDOW)
endif()
if (OPENGL_DEBUG)    
    set(exesuffix "${exesuffix}-gldebug")
    message("Defining OPENGL_DEBUG macro")
    add_compile_definitions(OPENGL_DEBUG)
endif()

add_executable(intro WIN32 "main.cpp" "4klang.asm" "minirocket.asm" ${SHADERS} "minirocket.h" "minirocket.inc")
set_source_files_properties(minirocket.asm OBJECT_DEPENDS ${CMAKE_CURRENT_BINARY_DIR}/minirocket.inc)
set_property(TARGET intro APPEND PROPERTY LINK_FLAGS " /ENTRY:entrypoint")                      
target_compile_definitions(intro PUBLIC XRES=${XRES} YRES=${YRES})
target_link_libraries(intro opengl32.lib winmm.lib libucrt.lib dsound.lib)
target_include_directories(intro PUBLIC ${SHADER_INCLUDE_DIR}) # for the shaders
target_include_directories(intro PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}) # for nasm to find 4klang
target_include_directories(intro PUBLIC ${CMAKE_CURRENT_BINARY_DIR}) # for the sync header

set_property(TARGET intro APPEND PROPERTY COMPILE_FLAGS " /Os /O1 /Ob1 /Oi /Oy /GS- /arch:IA32 /fp:fast")
if(NOT COMPRESS_LEVEL STREQUAL OFF)    
    find_program(CRINKLER NAMES Crinkler)
    if (NOT CRINKLER)
        message(WARNING "Crinkler not found. Cannot compress executable; using default linker. Get Crinkler from https://github.com/runestubbe/Crinkler & put it in path (as Crinkler.exe)")            
        set(COMPRESS_LEVEL OFF)
    endif()
endif()

if (NOT COMPRESS_LEVEL STREQUAL OFF)
    message(STATUS "Crinkler found at: ${CRINKLER}")      
    set(CRINKLER_FLAGS "/ENTRY:entrypoint /RANGE:opengl32 /PROGRESSGUI /UNSAFEIMPORT /UNALIGNCODE /HASHSIZE:1000 /REPORT:crinkler_report.html /EXPORT:NvOptimusEnablement=1")
    # TBD: do we add /SATURATE
    if (COMPRESS_LEVEL STREQUAL LIGHT) 
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:100 /COMPMODE:INSTANT /ORDERTRIES:2000")
        set(exesuffix "${exesuffix}-light")
    elseif (COMPRESS_LEVEL STREQUAL HEAVY)
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:1000 /COMPMODE:VERYSLOW /ORDERTRIES:30000")              
    else()
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:300 /COMPMODE:SLOW /ORDERTRIES:9000")
        set(exesuffix "${exesuffix}-medium")
    endif()   
    
    # we drop the whole manifest creation from the front; did not find a way to disable it from CMake otherwise        
    set (CMAKE_CXX_LINK_EXECUTABLE "${CRINKLER} <OBJECTS> /out:<TARGET> ${CRINKLER_FLAGS} <LINK_LIBRARIES>")
else()
    set(exesuffix "${exesuffix}-uncompressed")
    target_compile_definitions(intro PUBLIC UNCOMPRESSED)
endif()

add_custom_command(TARGET intro POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:intro> ${PROJECT_SOURCE_DIR}/dist/unnamed${exesuffix}.exe
)

# sync

if(COMPRESS_LEVEL STREQUAL OFF)    
    add_executable(sync WIN32 "main.cpp" "4klang.asm" ${SHADERS} minirocket_tracknames.h)
    set_property(TARGET sync APPEND PROPERTY LINK_FLAGS " /ENTRY:entrypoint")                      
    target_compile_definitions(sync PUBLIC SYNC=1 XRES=${XRES} YRES=${YRES})
    target_link_libraries(sync rkt_sync opengl32.lib winmm.lib libucrt.lib dsound.lib ws2_32.lib)
    target_include_directories(sync PUBLIC ${SHADER_INCLUDE_DIR}) # for the shaders
    target_include_directories(sync PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}) # for nasm to find 4klang
    target_include_directories(sync PUBLIC ${CMAKE_CURRENT_BINARY_DIR}) # for the sync header
    target_compile_definitions(sync PUBLIC UNCOMPRESSED)

    add_custom_command(TARGET sync POST_BUILD
       COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:sync> ${PROJECT_SOURCE_DIR}/dist/sync${exesuffix}.exe
    )
endif()

if (VALIDATE_SHADERS)
    find_program(GLSLANGVALIDATOR NAMES glslangValidator)
    if (NOT GLSLANGVALIDATOR)
        message(WARNING "glslangValidator not found. Cannot validate shaders. Get glslangValidator from: https://github.com/KhronosGroup/glslang")            
        set(VALIDATE_SHADERS OFF)
    endif()
endif()

if (VALIDATE_SHADERS)
    add_custom_command(TARGET intro POST_BUILD COMMAND ${GLSLANGVALIDATOR} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_SYNC_FRAG})
    if(COMPRESS_LEVEL STREQUAL OFF)    
        add_custom_command(TARGET sync POST_BUILD COMMAND ${GLSLANGVALIDATOR} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_SYNC_FRAG})
    endif()
endif()
