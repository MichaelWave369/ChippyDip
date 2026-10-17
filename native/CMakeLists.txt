cmake_minimum_required(VERSION 3.20)
project(ChippyDipNative VERSION 0.7.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(chippydip_core STATIC core/src/dsp.cpp)
set_target_properties(chippydip_core PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_include_directories(chippydip_core PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/core/include)
if(MSVC)
  target_compile_options(chippydip_core PRIVATE /W4 /permissive-)
else()
  target_compile_options(chippydip_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(chippydip-render tools/render.cpp)
target_link_libraries(chippydip-render PRIVATE chippydip_core)

include(CTest)
if(BUILD_TESTING)
  add_executable(chippydip-native-tests tests/dsp_tests.cpp)
  target_link_libraries(chippydip-native-tests PRIVATE chippydip_core)
  add_test(NAME core_dsp_regression COMMAND chippydip-native-tests)
  add_test(NAME render_smoke COMMAND chippydip-render --self-test)
endif()

# The SDK is an externally checked-out, MIT-licensed *API dependency*.
# It is not vendored into this repository. Ordinary native builds never
# download or require it.
option(CHIPPYDIP_BUILD_VST3 "Build the ChippyDip VST3 instrument" OFF)
set(CHIPPYDIP_VST3_SDK_PATH "" CACHE PATH "Path to an official VST3 SDK checkout")

if(CHIPPYDIP_BUILD_VST3)
  if(NOT EXISTS "${CHIPPYDIP_VST3_SDK_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "Set -DCHIPPYDIP_VST3_SDK_PATH to an official VST3 SDK checkout")
  endif()
  set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
  set(SMTG_CREATE_PLUGIN_LINK OFF CACHE BOOL "" FORCE)
  set(SMTG_RUN_VST_VALIDATOR OFF CACHE BOOL "" FORCE)
  add_subdirectory("${CHIPPYDIP_VST3_SDK_PATH}" "${CMAKE_CURRENT_BINARY_DIR}/vst3-sdk-build")
  smtg_enable_vst3_sdk()
  add_subdirectory(vst3)
endif()
