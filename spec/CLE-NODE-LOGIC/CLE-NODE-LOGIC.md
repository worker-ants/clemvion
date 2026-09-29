---
id: "CLE-NODE-LOGIC"
title: "Logic 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "031518d886ccc3cf632c460f4d1fe1794e04db21f3926a169912d6a977f38b0d"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/1-logic/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "5ef072c2ffd74813493ac8b6d58f0accc15acd09c63c30a0106c04813fa35fca"
etag: "sha256-713b58f384b71dafe3b84bde97ada7f90e2ce44be4dbd53cbc534af616c16e6f"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/_product-overview.md` (§4 머리말), `spec/4-nodes/1-logic/0-common.md` (문서 목록) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Logic 노드(Logic nodes)는 데이터 흐름의 경로 선택·반복·변수 관리 같은 프로그래밍식 제어를 맡는다. 이 영역은 Logic 카테고리 12종 노드와 그 공통 규약을 다룬다.

12종은 하는 일에 따라 다섯 묶음으로 나뉜다.

| 묶음 | 노드 | 하는 일 |
|------|------|---------|
| 조건 노드 | If/Else · Switch · Filter | 조건을 평가해 경로를 고르거나 배열을 나눈다 |
| 컨테이너 | Loop · ForEach · Map | 컨테이너 본문을 반복 실행하고 결과를 모은다 |
| 변수 노드 | 변수 선언 · 변수 수정 | 워크플로우 변수를 등록하고 바꾼다 |
| 데이터 노드 | Split · Merge | 배열을 정규화하거나 여러 입력을 합친다 |
| 병렬·비동기 | Parallel · Background | 병렬 분기를 동시에 돌리거나 본문을 비동기로 떼어 낸다 |

노드 전체 구조와 카탈로그는 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), 노드 출력 5필드 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 엔진이 컨테이너와 Parallel 을 도는 방식은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md) 이 정한다.

## 문서

- [Logic 노드 공통](CLE-NODE-LOGIC-COMMON.md): 조건 구조·비교 연산자·정규식 안전 컴파일, 컨테이너 패턴, 항목 에러 정책, 반복 결과 출력 구조, 동적 포트 ID, 엔진 덮어쓰기 계약, 패스스루 규약. 노드 출력 규약과 갈리는 결정 항목도 이곳에 모았다.
- [If/Else 노드](CLE-NODE-IFELSE.md): 조건식 결과로 `true` / `false` 포트 가운데 하나를 고르는 패스스루 노드.
- [Switch 노드](CLE-NODE-SWITCH.md): 값이나 조건에 맞는 케이스 포트(동적 포트)나 `default` 로 보내는 패스스루 노드.
- [Loop 노드](CLE-NODE-LOOP.md): 정한 횟수만큼 본문을 반복하는 컨테이너. `breakCondition` 과 `maxIterations` 로 멈춘다.
- [변수 선언 노드](CLE-NODE-VARDECL.md): 워크플로우 변수를 등록하는 패스스루 노드. 같은 이름이 있으면 덮어쓰지 않는다.
- [변수 수정 노드](CLE-NODE-VARSET.md): `set` · `increment` · `append` · `push` 같은 연산으로 변수를 바꾸는 패스스루 노드.
- [Split 노드](CLE-NODE-SPLIT.md): 배열을 `{ index, value }` 항목으로 정규화해 한 번에 내보내는 데이터 노드.
- [Map 노드](CLE-NODE-MAP.md): 항목마다 본문을 실행해 변환 결과 배열(`mapped`)을 만드는 컨테이너.
- [Filter 노드](CLE-NODE-FILTER.md): 배열 항목을 조건으로 나눠 `match` · `unmatched` 두 포트로 동시에 보내는 노드.
- [ForEach 노드](CLE-NODE-FOREACH.md): 항목마다 본문을 차례로 실행하고 결과(`items`)와 실패(`skipped`)를 나눠 모으는 컨테이너.
- [Parallel 노드](CLE-NODE-PARALLEL.md): 같은 입력으로 병렬 분기 N개를 동시에 실행하고 `{ branches, count }` 로 합치는 노드. 중첩 제한과 취소 정책을 포함한다.
- [Merge 노드](CLE-NODE-MERGE.md): 여러 선행 노드 결과를 병합 전략과 출력 형식에 따라 하나로 합치는 데이터 노드.
- [Background 노드](CLE-NODE-BACKGROUND.md): 본문을 별도 큐에서 fire-and-forget 으로 실행하고 메인 흐름은 바로 넘기는 노드. 본문 실행 모니터링 API 와 구독 채널을 포함한다.
