---
id: "CLE-WF-EXPR"
title: "표현식 언어"
type: "feature"
version: 2
status: "approved"
requirements: ["REQ-EXPR-001", "REQ-EXPR-002", "REQ-EXPR-003", "REQ-EXPR-004", "REQ-EXPR-005", "REQ-EXPR-006", "REQ-EXPR-007", "REQ-EXPR-008", "REQ-EXPR-009", "REQ-EXPR-010", "REQ-EXPR-011", "REQ-EXPR-012", "REQ-EXPR-013", "REQ-EXPR-014", "REQ-EXPR-015", "REQ-EXPR-016", "REQ-EXPR-017", "REQ-EXPR-018", "REQ-EXPR-019", "REQ-EXPR-020", "REQ-EXPR-021", "REQ-EXPR-022", "REQ-EXPR-023", "REQ-EXPR-024", "REQ-EXPR-025", "REQ-EXPR-026", "REQ-EXPR-027", "REQ-EXPR-028", "REQ-EXPR-029", "REQ-EXPR-030", "REQ-EXPR-031", "REQ-EXPR-032", "REQ-EXPR-033", "REQ-EXPR-034", "REQ-EXPR-035", "REQ-EXPR-036", "REQ-EXPR-037", "REQ-EXPR-038", "REQ-EXPR-039", "REQ-EXPR-040", "REQ-EXPR-041", "REQ-EXPR-042", "REQ-EXPR-043", "REQ-EXPR-044", "REQ-EXPR-045"]
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "7a5d18188b52909fa205f0716e8f257916b4bca5482e5e116acc8b18d2e677d6"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/3-workflow-editor/1-node-common.md", "spec/3-workflow-editor/_product-overview.md", "spec/5-system/5-expression-language.md"]
mirror_sha256: "892221512704645f32ae42c3f06a1ae539f8efcbee76174bfb7f37b933cbc982"
etag: "sha256-8f8394c58f3363459f6c5bb8a367375d0e8a32cf683f92fa563d5f73bea174de"
---
> 구현 상태: 구현됨 · 원문: `spec/5-system/5-expression-language.md`, `spec/3-workflow-editor/1-node-common.md` (§3 표현식 시스템), `spec/3-workflow-editor/_product-overview.md` (§5 ED-SP-03·04) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

표현식(Expression, `{{ }}`)은 노드 설정 필드 안에서 동적 값을 참조하고 간단한 연산을 하는 **읽기 전용 인라인 언어**다. 앞 노드의 출력, 워크플로우 변수, 실행 정보를 읽는다. 복잡한 데이터 변환은 [Transform 노드](../CLE-NODE-DATA/CLE-NODE-TRANSFORM.md) 와 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 가 맡고, 표현식은 **참조와 가벼운 연산**에 집중한다. 표현식은 노드를 실행하기 직전에 한 번 평가(evaluate)한다.

이 문서는 표현식 언어(Expression Language)의 문법, 타입, 내장 변수(built-in variables), 내장 함수, 에러, 에디터의 표현식 입력과 자동완성, 실행 엔진이 설정을 평가하는 방식, 보안 제약을 정한다.

범위 밖:

- 표현식이 읽는 노드 출력의 다섯 필드는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이, 엔진이 `$node` 에 노드 출력을 싣는 형태와 평가한 설정을 핸들러에 넘기는 단계는 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다.
- 반복 컨텍스트를 채우는 컨테이너 실행은 [컨테이너 실행](../CLE-EXEC/CLE-EXEC-CONTAINER.md), 실행 컨텍스트 필드 분류는 [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 가 정한다.
- 조건 노드의 조건 구조와 연산자는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md) 이 정한다.
- 스케줄 파라미터의 제한 표현식은 [스케줄](../CLE-TRIG/CLE-TRIG-SCHEDULE.md) 이 정한다.

## 요구사항

- REQ-EXPR-001 WHEN 사용자가 노드 설정 입력 필드에 `{{ }}` 표현식을 쓰면 THE SYSTEM SHALL 앞 노드 출력 등 참조한 값으로 평가해 노드에 넘긴다. (원본: ED-SP-03)
- REQ-EXPR-002 WHEN 사용자가 표현식을 입력하면 THE SYSTEM SHALL 자동완성을 제안하고 문법을 실시간으로 검사한다. (원본: ED-SP-04)
- REQ-EXPR-003 WHEN 표현식을 평가하면 THE SYSTEM SHALL 외부 상태를 바꾸지 않는다.
- REQ-EXPR-004 WHEN 같은 입력으로 표현식을 평가하면 THE SYSTEM SHALL 같은 결과를 낸다.
- REQ-EXPR-005 WHEN 난수·시간 함수를 평가하면 THE SYSTEM SHALL 실행 시점 값으로 고정한다(고정 단위는 미결 사항 참조).
- REQ-EXPR-006 WHEN 필드 값 전체가 표현식 하나이면 THE SYSTEM SHALL 평가 결과의 원래 타입(number, object, array 등)을 유지한다.
- REQ-EXPR-007 WHEN 필드 값이 텍스트와 표현식을 섞어 쓰면 THE SYSTEM SHALL 결과를 항상 문자열로 만든다.
- REQ-EXPR-008 WHEN 필드에 `\{\{` 를 쓰면 THE SYSTEM SHALL 표현식이 아닌 리터럴 `{{` 로 다룬다.
- REQ-EXPR-009 WHEN `==`·`!=` 로 비교하면 THE SYSTEM SHALL 느슨한 동등 연산자가 아닌 엄격한 연산자로 다룬다.
- REQ-EXPR-010 WHEN `&&`·`||` 를 평가하면 THE SYSTEM SHALL 단축 평가를 한다.
- REQ-EXPR-011 IF 조건 노드 설정에 `strictComparison: true` 가 있으면 THE SYSTEM SHALL 그 노드의 조건 평가에서 타입 자동 변환을 하지 않는다.
- REQ-EXPR-012 IF 중간 값이 `null` 인 경로를 `.` 로 접근하면 THE SYSTEM SHALL 에러를 낸다.
- REQ-EXPR-013 WHEN 표현식이 `?.` 로 접근하다 중간 값이 `null`·`undefined` 이면 THE SYSTEM SHALL 체인 전체를 `null` 로 끝낸다.
- REQ-EXPR-014 WHEN 웹훅 트리거로 시작한 실행이면 THE SYSTEM SHALL `$trigger` 에 요청의 `body`·`headers`·`query`·`method` 를 담는다.
- REQ-EXPR-015 IF 실행이 웹훅이 아닌 경로(수동·스케줄 등)로 시작했으면 THE SYSTEM SHALL `$trigger` 를 빈 객체 `{}` 로 둔다.
- REQ-EXPR-016 WHILE `$trigger.headers` 를 노출하는 동안 THE SYSTEM SHALL 민감 헤더 값을 `[REDACTED]` 로 가린다.
- REQ-EXPR-017 WHEN 실행이 재구동돼 컨텍스트를 다시 만들면 THE SYSTEM SHALL `$trigger` 를 `Execution.inputData` 에서 같은 값으로 복원한다.
- REQ-EXPR-018 WHILE Background 본문을 실행하는 동안 THE SYSTEM SHALL `$trigger` 를 빈 객체로 둔다(1차 범위).
- REQ-EXPR-019 WHEN 운영자가 `EXPRESSION_ENV_ALLOWLIST` 에 환경 변수 키를 적으면 THE SYSTEM SHALL 그 키만 `$env` 로 노출한다.
- REQ-EXPR-020 IF `EXPRESSION_ENV_ALLOWLIST` 가 비어 있으면 THE SYSTEM SHALL `$env` 를 빈 객체 `{}` 로 둔다.
- REQ-EXPR-021 IF 노드 설정 필드의 표현식 평가가 실패하면 THE SYSTEM SHALL 그 노드 실행을 실패로 처리하고 노드의 에러 처리 정책을 적용한다.
- REQ-EXPR-022 IF 에디터 미리보기에서 표현식 에러가 나면 THE SYSTEM SHALL 빨간 밑줄과 인라인 에러 메시지를 보여 주고 실행은 막지 않는다.
- REQ-EXPR-023 IF If/Else 조건 평가에서 에러가 나면 THE SYSTEM SHALL `false` 로 보지 않고 노드 실행을 실패로 처리한다.
- REQ-EXPR-024 IF 평가가 100ms 를 넘으면 THE SYSTEM SHALL `EXPR_TIMEOUT` 으로 멈춘다.
- REQ-EXPR-025 IF 중첩 깊이가 100 을 넘으면 THE SYSTEM SHALL `EXPR_DEPTH_EXCEEDED` 로 멈춘다.
- REQ-EXPR-026 WHILE 표현식을 평가하는 동안 THE SYSTEM SHALL 표현식 길이를 10,000자, 문자열 결과 크기를 1MB 이하로 제한한다.
- REQ-EXPR-027 WHEN 사용자가 `{{` 를 입력하면 THE SYSTEM SHALL 최상위 내장 변수 목록을 제안한다.
- REQ-EXPR-028 WHEN 사용자가 `$input.` 을 입력하면 THE SYSTEM SHALL 직전 노드의 출력 스키마에 있는 필드를 제안한다.
- REQ-EXPR-029 WHEN 사용자가 `$node["` 를 입력하면 THE SYSTEM SHALL 참조할 수 있는 노드 레이블 목록을 제안한다(범위는 미결 사항 참조).
- REQ-EXPR-030 WHILE Loop·ForEach 본문 안의 노드를 편집하는 동안 THE SYSTEM SHALL `$loop`·`$item`·`$itemIndex`·`$itemIsFirst`·`$itemIsLast` 를 제안한다.
- REQ-EXPR-031 WHILE Table 노드 열 표현식을 편집하는 동안 THE SYSTEM SHALL `$sourceItem`·`$sourceItemIndex`·`$dataSource` 를 추가로 제안한다.
- REQ-EXPR-032 IF 워크플로우를 한 번도 실행하지 않았으면 THE SYSTEM SHALL 함수 이름과 `$` 변수만 제안하고 필드 제안 자리에 "(워크플로우를 먼저 실행하세요)" 힌트를 보여 준다.
- REQ-EXPR-033 WHEN 노드가 기본 출력 스키마를 쓰면 THE SYSTEM SHALL 설정에 선언한 사용자 필드를 스키마에 넣어 자동완성을 돕는다.
- REQ-EXPR-034 IF 표현식이 접근할 수 없는 노드나 스코프 밖 변수를 참조하면 THE SYSTEM SHALL 주황색 경고를 표시한다.
- REQ-EXPR-035 WHEN 사용자가 필드의 모드 토글을 누르면 THE SYSTEM SHALL 그 필드를 정적 값과 표현식 모드 사이에서 바꾼다.
- REQ-EXPR-036 WHEN 실행 엔진이 노드를 실행하기 전이면 THE SYSTEM SHALL 설정 객체를 재귀로 돌며 문자열 값의 `{{ }}` 를 평가한다.
- REQ-EXPR-037 WHEN 설정 값이 number·boolean·null 이면 THE SYSTEM SHALL 평가하지 않고 그대로 넘긴다.
- REQ-EXPR-038 WHEN 평가 결과에 `{{ }}` 가 들어 있어도 THE SYSTEM SHALL 다시 평가하지 않는다.
- REQ-EXPR-039 WHILE 설정 객체를 평가하는 동안 THE SYSTEM SHALL 설정 구조 깊이를 10단계로 제한한다.
- REQ-EXPR-040 IF 노드를 만들거나 이름을 바꾸거나 캔버스를 저장할 때 같은 노드 레이블이 있으면 THE SYSTEM SHALL 막는다.
- REQ-EXPR-041 IF 노드 레이블에 `#` 문자가 있으면 THE SYSTEM SHALL 노드 생성·수정 요청을 거부한다.
- REQ-EXPR-042 IF 실행 시 같은 레이블의 노드가 둘 이상이면 THE SYSTEM SHALL 실행 순서대로 두 번째부터 `Label#2`, `Label#3` 처럼 구분한다.
- REQ-EXPR-043 WHEN 표현식이 `$node["<nodeId>"]` 를 쓰면 THE SYSTEM SHALL 레이블과 상관없이 그 UUID 의 노드를 참조한다.
- REQ-EXPR-044 WHEN 엔진이 `code`·`table`·`filter`·`loop` 노드의 설정을 평가하면 THE SYSTEM SHALL 표현식 제외 키를 미리 평가하지 않는다.
- REQ-EXPR-045 WHILE 표현식을 평가하는 동안 THE SYSTEM SHALL `eval` 을 쓰지 않고 자체 파서·평가기만 쓴다.

## 하위 문서

- [표현식 언어 — 문법 · 타입 · 함수](CLE-WF-EXPR-SYNTAX.md): 문법(BNF · 연산자 우선순위), 타입 변환 규칙과 Strict 모드, null 안전 접근, 내장 함수, 에러 코드 · 맥락별 동작 · 평가 제한. 맡는 요구사항: REQ-EXPR-005, REQ-EXPR-006, REQ-EXPR-007, REQ-EXPR-008, REQ-EXPR-009, REQ-EXPR-010, REQ-EXPR-011, REQ-EXPR-012, REQ-EXPR-013, REQ-EXPR-021, REQ-EXPR-022, REQ-EXPR-023, REQ-EXPR-024, REQ-EXPR-025, REQ-EXPR-026
- [표현식 언어 — 내장 참조 변수](CLE-WF-EXPR-VARS.md): 변수 목록, `$execution` · `$loop` · `$thread` 속성, `$trigger` 웹훅 요청 뷰와 `$env` 허용 목록 주입, 그 결정의 Rationale. 맡는 요구사항: REQ-EXPR-014, REQ-EXPR-015, REQ-EXPR-016, REQ-EXPR-017, REQ-EXPR-018, REQ-EXPR-019, REQ-EXPR-020
- [표현식 언어 — 에디터와 실행 엔진 통합](CLE-WF-EXPR-ENGINE.md): 표현식 입력 · 자동완성 · 스키마 보강, 파서와 평가기 구조, 실행 엔진의 설정 평가, `$node` 레이블 매핑, 표현식 제외 키. 맡는 요구사항: REQ-EXPR-001, REQ-EXPR-002, REQ-EXPR-027, REQ-EXPR-028, REQ-EXPR-029, REQ-EXPR-030, REQ-EXPR-031, REQ-EXPR-032, REQ-EXPR-033, REQ-EXPR-034, REQ-EXPR-035, REQ-EXPR-036, REQ-EXPR-037, REQ-EXPR-038, REQ-EXPR-039, REQ-EXPR-040, REQ-EXPR-041, REQ-EXPR-042, REQ-EXPR-043, REQ-EXPR-044

설계 원칙과 보안 절은 여러 하위 문서에 걸치므로 이 문서에 둔다(REQ-EXPR-003, REQ-EXPR-004, REQ-EXPR-045).

## 설계 원칙

| 원칙 | 설명 |
| --- | --- |
| 읽기 전용 | 외부 상태를 바꿀 수 없다. 부수 효과가 없다. |
| 결정적 | 같은 입력이면 같은 출력이다. 난수·시간 함수는 실행 시점 값으로 고정한다(고정 단위는 [미결 사항](#미결-사항) 참조). |
| 안전 | 무한 루프와 재귀가 없다. 최대 평가 깊이를 제한한다. |
| 가벼움 | 100ms 안에 평가를 끝내는 것이 목표다. |

## 내장 참조 변수

### 변수 목록

→ [표현식 언어 — 내장 참조 변수](CLE-WF-EXPR-VARS.md#변수-목록)

### `$loop` 속성

→ [표현식 언어 — 내장 참조 변수](CLE-WF-EXPR-VARS.md#loop-속성)

## 보안

| 위협 | 대응 |
| --- | --- |
| 코드 주입 | `eval` 을 쓰지 않는다. 자체 파서와 평가기만 쓴다. |
| 서비스 거부(복잡한 표현식) | 평가 시간 제한(100ms)과 중첩 깊이 제한(100) |
| 데이터 유출(`$env`) | 배포 운영자가 `EXPRESSION_ENV_ALLOWLIST` 로 **명시 허용한 키만** 노출한다. SaaS 기본은 `{}` 다([상세](CLE-WF-EXPR-VARS.md#env-환경-변수셀프-호스팅-전용-허용-목록)). |
| 데이터 유출(`$trigger`) | `$trigger.headers` 는 `Authorization`·`Cookie`·`X-Api-Key` 같은 민감 헤더를 가린다([상세](CLE-WF-EXPR-VARS.md#trigger-웹훅-요청-뷰)). |
| 재귀 평가 공격 | 한 번만 평가한다. 평가 결과에 `{{ }}` 가 있어도 다시 평가하지 않는다. |

## 미결 사항

- **자동완성의 노드 목록 범위**: [에디터와 실행 엔진 통합](CLE-WF-EXPR-ENGINE.md#자동완성) 의 자동완성 계기 표는 `$node["` 에서 현재 워크플로우의 **모든** 노드 레이블을 제안한다고 적는다. 노드 공통 원문(표현식 에디터)은 현재 노드에서 접근할 수 있는 **조상 노드**와 변수만 토폴로지 기준으로 보여 준다고 적는다. 현재 구현(`use-expression-context.ts`)은 `getAncestorsInScope` 로 조상 노드만 제안한다. 어느 쪽을 규칙으로 할지 결정이 필요하다.
- **`$execution.mode` 값**: [내장 참조 변수](CLE-WF-EXPR-VARS.md#execution-속성) 는 `mode` 가 `manual`·`webhook`·`schedule` 가운데 하나라고 적는다. 현재 구현의 실행 엔진은 `dispatchMeta` 에 `mode: 'manual'` 을 고정해 넘기고 resolver 기본값도 `'manual'` 이라 웹훅·스케줄 실행에서도 `'manual'` 이 나온다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 의 원문은 모양(`{ id, workflowId, startedAt, mode }`)만 같고 값 집합을 정하지 않는다. 실행 출처 분류는 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 에 있다. `mode` 를 실제 출처로 채울지, 뜻을 바꿔 적을지 결정이 필요하다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 은 이 결정을 표현식 언어 문서(이 문서와 하위 문서)에 맡긴다.
- **`$now` 를 고정하는 단위**: 이 문서의 [설계 원칙](#설계-원칙) 은 시간 함수를 "실행 시점 고정" 이라고만 적고, [내장 참조 변수](CLE-WF-EXPR-VARS.md#변수-목록) 는 `$now` 를 "현재 시각" 이라 적는다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 의 원문은 같은 실행 안에서 같은 값으로 고정한다고 적는다. 현재 구현은 `buildExpressionContext` 를 부를 때마다 새 시각을 만들어 노드마다 값이 다르다. 고정 단위가 실행 전체인지 노드 평가마다인지 결정이 필요하다. [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 은 이 결정을 표현식 언어 문서(이 문서와 하위 문서)에 맡긴다.
- **`triggerData` 필드와 실행 컨텍스트 규약**: [Rationale](CLE-WF-EXPR-VARS.md#rationale) 은 `ExecutionContext.triggerData` 를 어떤 노드 핸들러도 읽지 않는 resolver 전용 파생 필드라고 설명한다. [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md) 규약은 핸들러가 읽지 않는 필드를 `_` 접두 엔진 내부 필드로 두고 새 필드의 분류 근거를 규약에 적으라고 한다. 코드 필드 이름은 접두 없는 `triggerData` 이고 규약에 기록이 없다. 규약의 예외로 올릴지, `_triggerData` 로 바꿀지 결정이 필요하다.

## 구현 위치

구현 위치는 하위 문서마다 적는다. 공유 엔진 패키지는 문법 문서, `trigger-data.util.ts` 는 변수 문서, 컨텍스트 빌더를 포함한 나머지 백엔드 resolver · 프론트엔드 에디터는 에디터와 실행 엔진 통합 문서에 있다.
