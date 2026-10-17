cmake_minimum_required(VERSION 3.20)
project(ChippyDipNative VERSION 0.6.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(chippydip_core STATIC core/src/dsp.cpp)
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
