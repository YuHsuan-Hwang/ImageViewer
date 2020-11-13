# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: imageviewer.proto
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor.FileDescriptor(
  name='imageviewer.proto',
  package='ImageViewer',
  syntax='proto3',
  serialized_options=None,
  create_key=_descriptor._internal_create_key,
  serialized_pb=b'\n\x11imageviewer.proto\x12\x0bImageViewer\"s\n\x0bZoomRequest\x12\x17\n\x0fsend_start_time\x18\x01 \x01(\x03\x12\x1a\n\x12x_screensize_in_px\x18\x02 \x01(\x05\x12\x1a\n\x12y_screensize_in_px\x18\x03 \x01(\x05\x12\x13\n\x0bzoom_deltay\x18\x04 \x01(\x05\"T\n\rImageResponse\x12\x17\n\x0ftask_start_time\x18\x01 \x01(\x03\x12\x17\n\x0fsend_start_time\x18\x02 \x01(\x03\x12\x11\n\timage_url\x18\x03 \x01(\tb\x06proto3'
)




_ZOOMREQUEST = _descriptor.Descriptor(
  name='ZoomRequest',
  full_name='ImageViewer.ZoomRequest',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  create_key=_descriptor._internal_create_key,
  fields=[
    _descriptor.FieldDescriptor(
      name='send_start_time', full_name='ImageViewer.ZoomRequest.send_start_time', index=0,
      number=1, type=3, cpp_type=2, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
    _descriptor.FieldDescriptor(
      name='x_screensize_in_px', full_name='ImageViewer.ZoomRequest.x_screensize_in_px', index=1,
      number=2, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
    _descriptor.FieldDescriptor(
      name='y_screensize_in_px', full_name='ImageViewer.ZoomRequest.y_screensize_in_px', index=2,
      number=3, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
    _descriptor.FieldDescriptor(
      name='zoom_deltay', full_name='ImageViewer.ZoomRequest.zoom_deltay', index=3,
      number=4, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto3',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=34,
  serialized_end=149,
)


_IMAGERESPONSE = _descriptor.Descriptor(
  name='ImageResponse',
  full_name='ImageViewer.ImageResponse',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  create_key=_descriptor._internal_create_key,
  fields=[
    _descriptor.FieldDescriptor(
      name='task_start_time', full_name='ImageViewer.ImageResponse.task_start_time', index=0,
      number=1, type=3, cpp_type=2, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
    _descriptor.FieldDescriptor(
      name='send_start_time', full_name='ImageViewer.ImageResponse.send_start_time', index=1,
      number=2, type=3, cpp_type=2, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
    _descriptor.FieldDescriptor(
      name='image_url', full_name='ImageViewer.ImageResponse.image_url', index=2,
      number=3, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=b"".decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR,  create_key=_descriptor._internal_create_key),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto3',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=151,
  serialized_end=235,
)

DESCRIPTOR.message_types_by_name['ZoomRequest'] = _ZOOMREQUEST
DESCRIPTOR.message_types_by_name['ImageResponse'] = _IMAGERESPONSE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

ZoomRequest = _reflection.GeneratedProtocolMessageType('ZoomRequest', (_message.Message,), {
  'DESCRIPTOR' : _ZOOMREQUEST,
  '__module__' : 'imageviewer_pb2'
  # @@protoc_insertion_point(class_scope:ImageViewer.ZoomRequest)
  })
_sym_db.RegisterMessage(ZoomRequest)

ImageResponse = _reflection.GeneratedProtocolMessageType('ImageResponse', (_message.Message,), {
  'DESCRIPTOR' : _IMAGERESPONSE,
  '__module__' : 'imageviewer_pb2'
  # @@protoc_insertion_point(class_scope:ImageViewer.ImageResponse)
  })
_sym_db.RegisterMessage(ImageResponse)


# @@protoc_insertion_point(module_scope)
