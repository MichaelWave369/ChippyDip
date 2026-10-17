# Build this target only through native/CMakeLists.txt with CHIPPYDIP_BUILD_VST3=ON.
smtg_add_vst3plugin(ChippyDip
  processor.hpp
  processor.cpp
  controller.hpp
  controller.cpp
  ids.hpp
  factory.cpp
)
target_link_libraries(ChippyDip PRIVATE sdk chippydip_core)
target_include_directories(ChippyDip PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
set_target_properties(ChippyDip PROPERTIES
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED ON
)
