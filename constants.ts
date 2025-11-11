
import { FileNode } from './types';

export const initialFileTree: FileNode = {
  name: 'flutter_app',
  type: 'folder',
  path: 'flutter_app',
  children: [
    {
      name: 'lib',
      type: 'folder',
      path: 'lib',
      children: [
        { name: 'main.dart', type: 'file', path: 'lib/main.dart' },
      ],
    },
    { name: 'pubspec.yaml', type: 'file', path: 'pubspec.yaml' },
  ],
};

export const initialFileContents = new Map<string, string>([
  [
    'lib/main.dart',
    `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Flutter Demo Home Page'),
        ),
        body: const Center(
          child: Text(
            'Hello, World!',
          ),
        ),
      ),
    );
  }
}
`,
  ],
  [
    'pubspec.yaml',
    `name: flutter_app
description: A new Flutter project.

publish_to: 'none'

version: 1.0.0+1

environment:
  sdk: '>=2.12.0 <3.0.0'

dependencies:
  flutter:
    sdk: flutter

  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`,
  ],
]);
