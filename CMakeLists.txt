cmake_minimum_required(VERSION 3.16)
project(ImpellerGenerator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(impeller_gen
    main.cpp
    src/core/Geometry.cpp
    src/core/Geometry3D.cpp
    src/core/FluidDomain.cpp
    src/core/MeshQuality.cpp
    src/core/SteadyRansBaseline.cpp
    src/io/JsonExport.cpp
    src/io/CaseExport.cpp
    src/io/OpenFoamExport.cpp
    src/validation/GeometryValidation.cpp
)

target_include_directories(impeller_gen PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/src/core
    ${CMAKE_CURRENT_SOURCE_DIR}/src/io
    ${CMAKE_CURRENT_SOURCE_DIR}/src/validation
)
