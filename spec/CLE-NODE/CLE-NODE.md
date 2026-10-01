---
id: "CLE-NODE"
title: "노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "1f82e62b038ff7418fd0d65911c2dc07ccde762a67ab269b8992cd5d813d5ff8"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/_product-overview.md"]
mirror_sha256: "4e0c3b02f35ee4d1ba0a033210106b71624ef43b3916806c2d605c942e195baf"
etag: "sha256-fbd5fe618388cf454d556d4b306c20cb80ea23ccd94cd9b4722694726aafb5a0"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/_product-overview.md` (§1), `spec/4-nodes/` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

노드는 워크플로우의 기본 구성 단위다. 노드마다 한 가지 기능을 맡고, 입력 포트로 데이터를 받아 처리한 뒤 출력 포트로 결과를 넘긴다. 노드는 트리거·Logic·Flow·AI·통합·Data·Presentation 일곱 카테고리로 나뉜다.

이 영역은 노드 시스템 전체를 다룬다. 모든 노드가 따르는 구조·출력 규약·에러 처리 정책을 먼저 정하고, 카테고리마다 공통 규약과 노드별 문서를 둔다. 노드를 워크플로우에 배치하고 연결하는 편집 화면은 [워크플로우 작성](../CLE-WF/CLE-WF.md), 엔진이 노드를 실행하는 방식은 [실행](../CLE-EXEC/CLE-EXEC.md) 영역이 다룬다.

## 문서

모든 노드에 걸치는 문서는 다음과 같다.

- [노드 시스템 구조와 카탈로그](CLE-NODE-ARCH.md): 백엔드 노드 컴포넌트 구조와 부팅 등록, 메타데이터 API, 노드 정의·포트 정의 속성, 설정 요약 템플릿 문법, 전체 노드 카탈로그, 카테고리 색, 커스텀 노드 계획, 샌드박스
- [노드 출력 규약](CLE-NODE-OUTPUT.md): 노드 출력(`NodeHandlerOutput`) 다섯 필드의 뜻과 배치 규칙. 노드 문서가 Principle 번호로 인용하는 규칙집
- [노드 에러 처리 정책](CLE-NODE-ERROR.md): 노드가 실패했을 때의 다섯 가지 정책, 에러 포트 라우팅, 노드 재시도, 워크플로우 수준 자동 재시도

카테고리별 하위 영역은 다음과 같다.

- [트리거 노드](../CLE-NODE-TRIG/CLE-NODE-TRIG.md): 워크플로우 진입점인 수동 트리거 노드와 세 진입 경로의 파라미터 계약
- [Logic 노드](../CLE-NODE-LOGIC/CLE-NODE-LOGIC.md): 분기·반복·변수·배열 처리·병렬처럼 한 워크플로우 안의 흐름을 제어하는 노드 12종
- [Flow 노드](../CLE-NODE-FLOW/CLE-NODE-FLOW.md): 다른 워크플로우를 부르는 워크플로우 호출 노드
- [AI 노드](../CLE-NODE-AI/CLE-NODE-AI.md): LLM 을 부르는 AI 에이전트·텍스트 분류기·정보 추출기 노드
- [통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md): 통합을 참조해 외부 서비스를 부르는 노드 5종
- [Data 노드](../CLE-NODE-DATA/CLE-NODE-DATA.md): 데이터를 변환하는 Transform·Code 노드
- [Presentation 노드](../CLE-NODE-PRES/CLE-NODE-PRES.md): 결과를 보여 주고 사용자 입력을 받는 노드 5종
