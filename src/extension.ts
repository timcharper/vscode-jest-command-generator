// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { env } from "vscode";
import * as vscode from "vscode";
import * as parser from "@babel/parser";
import * as t from "@babel/types";
import traverse from "@babel/traverse";

function getCurrentTestName(
  document: vscode.TextDocument,
  position: vscode.Position
): string | null {
  const text = document.getText();
  const ast = parser.parse(text, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });
  let testName: string | null = null;

  traverse(ast, {
    enter(path) {
      if (path.isCallExpression()) {
        const callee = path.node.callee;

        let calleeName: string | null = null;

        // Type guard for Identifier
        if (t.isIdentifier(callee)) {
          calleeName = callee.name;
        }
        // Type guard for MemberExpression (e.g., test.only, it.skip)
        else if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property)
        ) {
          calleeName = callee.property.name;
        }

        if (calleeName && ["it", "test"].includes(calleeName)) {
          const testNode = path.node;
          const start = document.positionAt(testNode.start!);
          const end = document.positionAt(testNode.end!);
          const range = new vscode.Range(start, end);

          if (range.contains(position) && testNode.arguments.length > 0) {
            const arg = testNode.arguments[0];
            if (t.isStringLiteral(arg)) {
              testName = arg.value;
            }
          }
        }
      }
    },
  });

  return testName;
}

function buildJestCommandForTest(
  testName: string,
  fileUri: vscode.Uri
): string {
  const relativePath = vscode.workspace.asRelativePath(fileUri);
  return `jest "${relativePath}" -t "${testName}"`;
}

function buildJestCommandForFile(fileUri: vscode.Uri): string {
  const relativePath = vscode.workspace.asRelativePath(fileUri);
  return `jest "${relativePath}"`;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let copyCurrentTestCommand = vscode.commands.registerCommand(
    "jestCommandGenerator.copyCurrentTestCommand",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const position = editor.selection.active;
        const testName = getCurrentTestName(document, position);
        const fileUri = document.uri;

        let command = "";
        if (testName) {
          command = buildJestCommandForTest(testName, fileUri);
        } else {
          command = buildJestCommandForFile(fileUri);
        }

        env.clipboard.writeText(command);
        vscode.window.showInformationMessage(
          "Jest command copied to clipboard!"
        );
      }
    }
  );

  let copyFileTestCommand = vscode.commands.registerCommand(
    "jestCommandGenerator.copyFileTestCommand",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const fileUri = document.uri;

        const command = buildJestCommandForFile(fileUri);
        env.clipboard.writeText(command);
        vscode.window.showInformationMessage(
          "Jest command copied to clipboard!"
        );
      }
    }
  );

  context.subscriptions.push(copyCurrentTestCommand, copyFileTestCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
