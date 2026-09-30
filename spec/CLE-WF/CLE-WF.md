---
id: "CLE-WF"
title: "워크플로우 작성"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "51e87c93f0152a2fa6e50ffb4e7f2b128b80742a9ebea0f3f5674bb463984967"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/1-workflow-list.md", "spec/3-workflow-editor/*.md", "spec/3-workflow-editor/_product-overview.md", "spec/5-system/5-expression-language.md", "spec/conventions/cross-node-warning-rules.md", "spec/data-flow/11-workflow.md"]
mirror_sha256: "2969602cd7de19a200a88688549f113475b7cd2df7985210bb628c96de51273d"
etag: "sha256-30cc65931929c3ff5ab6b82ad2a30d64f2bc1a9002b30ebdb15e26e5e7b71bd5"
---
> 구현 상태: 부분 구현 · 원문: `spec/3-workflow-editor/_product-overview.md` (§1), `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/*.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/data-flow/11-workflow.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 사용자가 워크플로우를 찾고 만들고 고치는 일을 다룬다. 워크플로우 목록에서 워크플로우를 고르거나 새로 만들면 에디터로 들어간다. 에디터는 이 제품의 핵심 화면이다. 사용자는 캔버스 위에 노드를 놓고 연결선으로 이어 자동화 로직을 눈으로 보며 만든다. n8n 과 비슷한 노드 기반 편집 방식을 따르면서 AI 노드와 고급 로직 노드를 더 제공한다.

영역에 드는 것은 워크플로우 목록과 폴더, 에디터와 캔버스, 노드 포트와 설정 패널, 연결선, 버전 기록, 그래프 경고 규칙, 표현식 언어, 워크플로우 데이터와 저장 흐름, AI 어시스턴트다. 노드별 동작은 [노드](../CLE-NODE/CLE-NODE.md) 영역이, 에디터에서 실행하고 결과를 보는 일은 [실행](../CLE-EXEC/CLE-EXEC.md) 영역이 정한다.

## 문서

| 문서 | 다루는 것 |
| --- | --- |
| [워크플로우 목록과 폴더](CLE-WF-LIST.md) | 목록 화면의 검색·필터·정렬, 생성·복제·삭제·활성 토글, 폴더 API, 내보내기·가져오기 JSON 형식 |
| [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md) | 에디터 레이아웃과 헤더, 캔버스 인터랙션, 노드 팔레트, 노드 시각 표현, 저장 모델, 키보드 단축키, 컨테이너 편집 UX |
| [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md) | 포트 체계와 노드별 포트 문서 목록, 설정 패널, 에러 처리 정책 설정, auto-form, 노드 사이 데이터 전달 |
| [연결선](CLE-WF-EDGE.md) | 연결선 생성·다시 잇기·분할, 연결 유효성과 순환 경고, 연결선 스타일, 데이터 미리보기, 컨테이너 연결선 규칙, 불러올 때 자동 정리 |
| [버전 기록](CLE-WF-VERSION.md) | 버전 기록 패널, 상세·비교·복원 다이얼로그, 버전 API, 변경 요약 |
| [그래프 경고 규칙](CLE-WF-WARN.md) | 노드 하나로 판단할 수 없는 그래프 수준 경고 규칙의 구조, 심각도 정책, 3중 가드, 등록된 규칙 |
| [표현식 언어](CLE-WF-EXPR.md) | `{{ }}` 문법, 타입, 내장 변수와 함수, 에러, 자동완성, 실행 엔진의 설정 평가 |
| [워크플로우 데이터와 저장 흐름](CLE-WF-DATA.md) | Workflow·Folder·Node·Edge·WorkflowVersion 엔티티, 저장과 버전 스냅샷 흐름, 복제·내보내기·가져오기, 삭제 때 FK 파급 |
| [워크플로우 AI 어시스턴트](CLE-WF-ASSIST.md) | 자연어 요청으로 노드와 연결선을 만드는 AI 어시스턴트의 대화 루프·패널 UI·에러·성능 가드 |
| [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) | AI 어시스턴트가 쓰는 탐색·계획·편집·실행 조회 도구와 Shadow 검증 |
| [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md) | SSE 프로토콜, 어시스턴트 세션·메시지 REST API 와 엔티티 |
