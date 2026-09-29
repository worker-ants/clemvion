---
id: "CLE-NODE-DATA"
title: "Data 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "143181a0e501b649238e54808f76fb33f6d7d8efc459dbc35752e322d9898c04"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/5-data/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "bd66c8d91d94bfc600964ce38aad248aca1c115437e616f3bcb1bf5f7b9e2ed6"
etag: "sha256-917b6afcce47462fc5624a67a8b29c3e9959313dd8208c001ddb0ec8d02d6228"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/_product-overview.md` (§8 머리말), `spec/4-nodes/5-data/0-common.md` (문서 목록) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Data 노드는 데이터 변환과 코드 실행을 맡는 노드다. 두 종류가 있다. 표현식은 값을 참조만 할 수 있으므로 데이터 변환은 모두 이 영역의 노드가 맡는다. 코드 없이 시각적 빌더로 변환하려면 Transform 노드를, 빌더로 표현하기 어려운 로직에는 Code 노드를 쓴다.

표현식 문법은 [표현식 언어](../CLE-WF/CLE-WF-EXPR.md)가, 배열을 조건으로 나누는 일은 [Logic 노드](../CLE-NODE-LOGIC/CLE-NODE-LOGIC.md) 영역의 Filter 노드가 다룬다.

## 문서

- [Data 노드 공통](CLE-NODE-DATA-COMMON.md): 표현식 평가 위치, 노드 샌드박스 적용 범위, 캔버스 요약, 노드 출력 사용 방식, 두 노드의 에러 계약 차이.
- [Transform 노드](CLE-NODE-TRANSFORM.md): 변환 연산(필드 이름 변경·타입 변환·문자열·수학·날짜·배열·객체 연산)을 차례로 적용하는 노드. 실행 중 무결성 실패는 건너뛴다(no-op).
- [Code 노드](CLE-NODE-CODE.md): `isolated-vm` 노드 샌드박스에서 JavaScript 를 실행하는 노드. `$input`·`$vars`·`$helpers`, 리소스 제한, 허용·차단 API, 런타임 에러 포트.
