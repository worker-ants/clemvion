---
id: "CLE-NODE-PRES"
title: "Presentation 노드"
type: "area"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "be4e8d94da56fd3a78535498433a58370553b2800aa146f35cd8ccf80030e908"
read_as: "approved_fallback"
task: "CLE-T-9W8F72"
source_paths: ["spec/4-nodes/_product-overview.md"]
mirror_sha256: "4076bad6f67c132e6e58a1d6077fdbb3a96e614fd7e0ec77979394276c593902"
etag: "sha256-d6ac480abd700efe7f234619e83aecc44b041f9f0952be08713d725e3d4bf61b"
---
> 구현 상태: 구현됨 (노드별 미결 사항은 각 문서 참조) · 원문: `spec/4-nodes/_product-overview.md` (§9 머리글), `spec/4-nodes/6-presentation/` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 Presentation 노드(presentation nodes) 다섯 종을 다룬다. 다섯 종은 Carousel, Table, Chart, Form, Template 이다. 워크플로우 실행 결과를 사람이 읽기 좋은 형태로 구조화한다. 필요하면 실행을 멈추고 사용자 입력을 받는다.

Presentation 노드의 목적은 두 가지다.

- 다운스트림 노드에 구조화된 결과(슬라이드 목록, 표 행, 차트 포인트, 제출 값, 렌더링한 문자열)를 넘긴다.
- 실행 결과 드로어와 웹채팅 같은 화면에서 사람이 결과를 눈으로 확인하게 한다.

버튼이 없는 노드는 결과를 보여 주고 바로 다음 노드로 넘어간다(표시 전용). 버튼이 있는 Carousel·Table·Chart·Template 과 모든 Form 노드는 입력 대기로 멈추고 사용자가 버튼을 누르거나 폼을 제출하면 재개한다(블로킹 모드). AI 에이전트 노드는 같은 다섯 노드의 스키마를 표시 도구(`render_*`)로 불러 대화 안에 표·차트·캐러셀·템플릿·폼을 그린다.

## 문서

- [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md): 버튼 정의와 버튼 편집기, 포트 구성, 블로킹 모드 흐름, 출력 포맷과 1MB 출력 크기 한도, 대화 스레드 opt-out, 실행 결과 드로어 표시, AI 에이전트 표시 도구(`render_*`) 모드.
- [Carousel 노드](CLE-NODE-CAROUSEL.md): 정적·동적 모드 슬라이드 목록, 전역 버튼과 항목 버튼, 인터랙티브 채널과 드로어의 두 렌더 표면.
- [Table 노드](CLE-NODE-TABLE.md): 정적·동적 모드 표, 컬럼 표현식, 정렬과 페이지 크기, 한도 전 행 수 `totalRows`.
- [Chart 노드](CLE-NODE-CHART.md): X축 기준 집계로 `{ x, y?, series? }[]` 포인트 배열을 만들어 그리는 차트. 에디터는 recharts 로, 웹채팅 위젯은 자체 SVG 렌더러로 그린다. 다중 시리즈는 포인트마다 `series` 로 구분한다.
- [Form 노드](CLE-NODE-FORM.md): 사용자 입력 폼을 보여 주고 제출을 기다리는 블로킹 노드. 필드 유형, 검증 규칙, 파일 필드 메타데이터 제출.
- [Template 노드](CLE-NODE-TEMPLATE.md): 표현식을 채운 HTML·Markdown·Text 문자열을 `output.rendered` 로 내는 노드.

노드 출력의 일반 규칙은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md), 입력 대기와 재개 메커니즘은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한다.
