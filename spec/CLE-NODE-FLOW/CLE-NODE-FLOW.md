---
id: "CLE-NODE-FLOW"
title: "Flow 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "8ffc671c8e572b3c94d803f2da999392131993847fbdf73d6ecccc5e82b8c943"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "c8bd201ace180e84d00bbc017cec12b7f9a0407402d44b30f1d75de3d4a1f785"
etag: "sha256-ad5bcb8374d5a2631f8b6ff585b7388bdd0889e1e4cbed9e7eb14e16d5389122"
---
> 구현 상태: 구현됨(메타 노출 일부 미구현) · 원문: `spec/4-nodes/2-flow/` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Flow 노드는 워크플로우 사이를 잇는 노드 카테고리다. 한 워크플로우가 다른 워크플로우를 서브 워크플로우로 부르거나, 여러 워크플로우 사이의 데이터와 실행 흐름을 잇는다. 한 워크플로우 안의 흐름 제어(분기, 반복, 변수, 병렬)는 [Logic 노드](../CLE-NODE-LOGIC/CLE-NODE-LOGIC.md)가 맡는다.

지금 Flow 카테고리 노드는 워크플로우 호출 노드 하나다. 워크플로우 사이 연결을 다루는 노드가 나중에 더해질 수 있고, 카테고리 공통 규약이 그 기반이다. 노드 시스템 전체 구조와 카탈로그는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)에 있다.

## 문서

- [Flow 노드 공통](CLE-NODE-FLOW-COMMON.md): 카테고리 정의, 노드 출력 다섯 필드의 사용 방식, 에러 계약, 재귀 호출 방지, 설정 요약 규칙
- [워크플로우 호출 노드](CLE-NODE-SUBWF.md): 다른 워크플로우를 동기·비동기로 부르는 노드의 설정, 포트, 실행 로직, 출력 형태, 에러 코드, 워크스페이스 격리
