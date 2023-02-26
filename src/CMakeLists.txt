option(WINDOW "Define WINDOW macro, showing the intro in a small window instead of full screen" OFF)
option(MINIFY_SHADERS "Use shader_minified minified shaders instead of hand-tuned ones" ON)
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
 
message(STATUS "Configuration options (configure with cmake -D...): WINDOW=${WINDOW} MINIFY_SHADERS=${MINIFY_SHADERS} COMPRESS_LEVEL=${COMPRESS_LEVEL}")

set(SHADER_HANDTUNED_INL shader.inl)

if (MINIFY_SHADERS)
    find_program(SHADER_MINIFIER NAMES shader_minifier)
    if (NOT SHADER_MINIFIER)
        message(WARNING "Shader_minifier not found. Cannot minify shaders; using always the hand inlined versions (*.inl). Get shader_minifier from: https://www.ctrl-alt-test.fr/glsl-minifier/")            
        set(MINIFY_SHADERS OFF)
    endif()
endif()

if (MINIFY_SHADERS)
    message(STATUS "Shader_minifier found at: ${SHADER_MINIFIER}")      
    # Generate the minified inlined shaders        
    set(SHADER_FRAG ../data/shader.frag)    
    set(SHADER_CONFIGURED_FRAG configured/shader.frag)    
    set(SHADER_MINIFIED_INL minified/shader.inl)    
    configure_file(
        ${SHADER_FRAG}
        ${SHADER_CONFIGURED_FRAG}
    )    
    add_custom_command(
        OUTPUT ${SHADER_MINIFIED_INL}
        COMMAND ${SHADER_MINIFIER} -o ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_MINIFIED_INL} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_CONFIGURED_FRAG}
        DEPENDS ${SHADER_CONFIGURED_FRAG}
    )    
    set(SHADERS ${SHADER_MINIFIED_INL})
    set(SHADER_INCLUDE_DIR ${CMAKE_CURRENT_BINARY_DIR}/minified/)    
else()
    #should be, but we don't have the hand minified shaders yet 'set(SHADERS ${SHADER_HANDTUNED_INL})
    set(SHADERS ${SHADER_MINIFIED_INL})
    set(SHADER_INCLUDE_DIR ${CMAKE_CURRENT_SOURCE_DIR})
endif()

add_executable(intro WIN32 "main.cpp" "4klang.asm" ${SHADERS})
set_property(TARGET intro APPEND PROPERTY LINK_FLAGS " /ENTRY:entrypoint")                      
target_compile_definitions(intro PUBLIC XRES=${XRES} YRES=${YRES})
target_link_libraries(intro opengl32.lib winmm.lib libucrt.lib dsound.lib)
target_include_directories(intro PUBLIC ${SHADER_INCLUDE_DIR}) # for the shaders
target_include_directories(intro PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}) # for nasm to find 4klang

#set_target_properties(intro PROPERTIES
#                      RUNTIME_OUTPUT_DIRECTORY ${PROJECT_SOURCE_DIR}/dist
#)

set(exename "unnamed8k")
if (NOT YRES EQUAL "1080")
    set(exename "${exename}-${YRES}")
endif()
if (WINDOW)
    set(exename "${exename}-window")
    message("Defining WINDOW macro")
    target_compile_definitions(intro PUBLIC WINDOW)
endif()
if (OPENGL_DEBUG)
    set(exename "${exename}-debug")
    target_compile_definitions(intro PUBLIC OPENGL_DEBUG)
endif()

if(NOT COMPRESS_LEVEL STREQUAL OFF)
    set_property(TARGET intro APPEND PROPERTY COMPILE_FLAGS " /Os /O1 /Ob1 /Oi /Oy")
    find_program(CRINKLER NAMES Crinkler)
    if (NOT CRINKLER)
        message(WARNING "Crinkler not found. Cannot compress executable; using default linker. Get Crinkler from https://github.com/runestubbe/Crinkler & put it in path (as Crinkler.exe)")            
        set(COMPRESS_LEVEL OFF)
    endif()
endif()

if (NOT COMPRESS_LEVEL STREQUAL OFF)
    message(STATUS "Crinkler found at: ${CRINKLER}")      
    set(CRINKLER_FLAGS "/ENTRY:entrypoint /RANGE:opengl32 /PROGRESSGUI /UNSAFEIMPORT /UNALIGNCODE /HASHSIZE:1000 /REPORT:crinkler_report.html")
    # TBD: do we add /SATURATE
    if (COMPRESS_LEVEL STREQUAL LIGHT) 
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:100 /COMPMODE:INSTANT /ORDERTRIES:2000")
        set(exename "${exename}-light")
    elseif (COMPRESS_LEVEL STREQUAL HEAVY)
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:1000 /COMPMODE:VERYSLOW /ORDERTRIES:30000")              
    else()
        set(CRINKLER_FLAGS "${CRINKLER_FLAGS} /HASHTRIES:300 /COMPMODE:SLOW /ORDERTRIES:9000 /TRUNCATEFLOATS:32")
        set(exename "${exename}-medium")
    endif()   
    
    # we drop the whole manifest creation from the front; did not find a way to disable it from CMake otherwise        
    set (CMAKE_CXX_LINK_EXECUTABLE "${CRINKLER} <OBJECTS> /out:<TARGET> ${CRINKLER_FLAGS} <LINK_LIBRARIES>")
else()
    set(exename "${exename}-uncompressed")
endif()

#set_target_properties(intro PROPERTIES OUTPUT_NAME ${exename})
add_custom_command(TARGET intro POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:intro> ${PROJECT_SOURCE_DIR}/dist/${exename}.exe
)

if (VALIDATE_SHADERS)
    find_program(GLSLANGVALIDATOR NAMES glslangValidator)
    if (NOT VALIDATE_SHADERS)
        message(WARNING "glslangValidator not found. Cannot validate shaders. Get glslangValidator from: https://github.com/KhronosGroup/glslang")            
        set(VALIDATE_SHADERS OFF)
    endif()
endif()

if (VALIDATE_SHADERS)
    add_custom_command(TARGET intro POST_BUILD
        COMMAND ${GLSLANGVALIDATOR} ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_CONFIGURED_FRAG})
endif()
