---
id: "CLE-NODE-TRIG"
title: "트리거 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "36518c7e40b0b4c6f6414be9b3fdab19abeba51510930247835ddbd0a2649b4a"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/_product-overview.md"]
mirror_sha256: "ffa9b759294f22c920dc594b42bd320a9908b4e34e65b51914b081536e734363"
etag: "sha256-10deb078dca97eb9ea2a1e4bb54a4f48e36fda1ab617c988bbe769a0868809c4"
---
> 구현 상태: 구현됨(설정 요약은 미구현) · 원문: `spec/4-nodes/7-trigger/`, `spec/4-nodes/_product-overview.md` (§3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

트리거 카테고리 노드는 워크플로우의 진입점이 되는 노드다. 모든 워크플로우에는 트리거 카테고리 노드가 반드시 하나 있고, 워크플로우를 만들 때 자동으로 배치된다. 이 노드에는 입력 포트가 없고, 출력 포트로 워크플로우 입력 데이터를 다음 노드에 넘긴다.

지금 트리거 카테고리 노드는 수동 트리거 노드 하나다. 이름과 달리 수동 실행, 웹훅 실행, 스케줄 실행이 모두 이 노드에서 시작한다. 세 진입 경로는 이 노드에 정의한 트리거 파라미터 스키마 하나를 함께 쓴다.

워크플로우를 시작시키는 트리거 엔티티(웹훅·스케줄·수동 트리거)의 관리와 외부 호출 인증은 [트리거](../CLE-TRIG/CLE-TRIG.md) 영역이 다룬다. 노드 시스템 전체 구조와 카탈로그는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)에 있다.

## 문서

- [트리거 노드 공통](CLE-NODE-TRIG-COMMON.md): 세 진입 경로가 공유하는 트리거 파라미터 계약과 스키마, 진입 어댑터 입력 형태, 노드 출력 사용 방식
- [수동 트리거 노드](CLE-NODE-MANUAL.md): 수동 트리거 노드의 설정, 포트, 실행 로직, 출력 형태, 파라미터 검증과 에러, 설정 요약
