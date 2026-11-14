---
id: "CLE-TRIG-AUTHCFG"
title: "외부 호출 인증 설정"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-AUTHCFG-001", "REQ-AUTHCFG-002", "REQ-AUTHCFG-003", "REQ-AUTHCFG-004", "REQ-AUTHCFG-005", "REQ-AUTHCFG-006", "REQ-AUTHCFG-007", "REQ-AUTHCFG-008", "REQ-AUTHCFG-009", "REQ-AUTHCFG-010", "REQ-AUTHCFG-011", "REQ-AUTHCFG-012", "REQ-AUTHCFG-013", "REQ-AUTHCFG-014", "REQ-AUTHCFG-015", "REQ-AUTHCFG-016", "REQ-AUTHCFG-017", "REQ-AUTHCFG-018", "REQ-AUTHCFG-019", "REQ-AUTHCFG-020", "REQ-AUTHCFG-021", "REQ-AUTHCFG-022", "REQ-AUTHCFG-023", "REQ-AUTHCFG-024", "REQ-AUTHCFG-025", "REQ-AUTHCFG-026", "REQ-AUTHCFG-027", "REQ-AUTHCFG-028", "REQ-AUTHCFG-029", "REQ-AUTHCFG-030", "REQ-AUTHCFG-031", "REQ-AUTHCFG-032", "REQ-AUTHCFG-033", "REQ-AUTHCFG-034"]
basis_superseded: false
parent: "CLE-TRIG"
ancestors: ["CLE-VISION", "CLE-TRIG"]
area: "CLE-TRIG"
content_hash: "7b934e5a089056d18e0a22b8d1a30fb8d7ccf94dcae5072b0e1cfdfc401556ac"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/1-data-model.md", "spec/2-navigation/6-config.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "d1f100fe0f5d65dcfa52c550a2819e73dc85daa3aede25dd7f4bb985cff1178a"
etag: "sha256-47544a4a8c1198199481cd76575b3dbc064c9814d5ff9a7c330916fc8cd1f1b0"
---
> 구현 상태: 구현됨 · 원문: `spec/2-navigation/6-config.md` (Overview, Part A, §3 Authentication API, Rationale R-2·R-6), `spec/2-navigation/_product-overview.md` (§3.6 Authentication), `spec/1-data-model.md` (§2.17.2 마스킹·노출 정책) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

인증 설정(AuthConfig, `auth_config`)은 외부 시스템이 이 제품의 트리거를 부를 때 쓰는 워크스페이스 단위 인증 자격 증명이다. 워크플로우를 편집할 때마다 자격 증명을 입력하는 대신, 여기서 한 번 만든 인증 설정을 여러 웹훅 트리거가 연결해 쓴다. 현재 인증 설정이 연결되는 곳은 웹훅 수신 인증이다. 로그인 인증이나 통합 자격 증명과는 다른 개념이다.

인증 설정 화면은 사이드바 최상위 메뉴 "Authentication"(경로 `/authentication`)이다. 모델 설정 화면과 "설정(Config)" 으로 묶는 것은 분류용이고 실제 메뉴는 둘 다 최상위에 있다. 두 메뉴를 나중에 Config 그룹으로 다시 묶을 수는 있다.

이 문서는 인증 설정 목록 화면, 인증 방식(인증 설정 유형, `AuthConfig.type`)별 입력 항목, 편집, 재생성, 사용 내역(usage), 필드 마스킹(`***<last4>`)과 평문 보기(Reveal), 권한, 인증 설정 API 를 정한다. 입력 항목 · 편집 · 재생성과 마스킹 · 평문 보기는 [하위 문서](#하위-문서)가 맡는다.

범위 밖 주제는 다음 문서가 정한다.

- 엔티티 컬럼, 유형별 `config` JSONB 스키마, 자동 발급 값의 접두사: [트리거 데이터와 흐름](CLE-TRIG-DATA.md)
- 웹훅 요청을 인증 설정으로 검증하는 방식: [웹훅](CLE-TRIG-WEBHOOK.md)
- 트리거에 인증 설정을 연결하는 화면과 API: [트리거 관리](CLE-TRIG-MANAGE.md)
- 역할별 권한 매트릭스: [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md). 감사 action: [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)
- 같은 원문에 있던 모델 설정(Chat·Embedding·Rerank) 화면과 API: [모델 설정](../CLE-AI/CLE-AI-MODELS.md)

## 요구사항

- REQ-AUTHCFG-001 WHEN 관리자 이상이 인증 설정을 만들면 THE SYSTEM SHALL 외부 호출자가 트리거를 부를 때 쓸 인증 방식(API Key·Bearer Token·Basic Auth·HMAC)을 저장한다. (원본: NAV-CA-01)
- REQ-AUTHCFG-002 WHEN API Key 유형을 만들면 THE SYSTEM SHALL `wfk_<hex24>` 키를 자동으로 발급한다. (원본: NAV-CA-02)
- REQ-AUTHCFG-003 WHEN Bearer Token 유형을 만들면 THE SYSTEM SHALL `wft_<hex32>` 토큰을 자동으로 발급하고 사용자가 입력한 토큰은 받지 않는다. (원본: NAV-CA-03)
- REQ-AUTHCFG-004 WHEN Basic Auth 유형을 만들면 THE SYSTEM SHALL 사용자 이름과 비밀번호를 필수 사용자 입력으로 받는다. (원본: NAV-CA-04)
- REQ-AUTHCFG-005 WHEN HMAC 유형을 만들면 THE SYSTEM SHALL `whs_<hex32>` 시크릿을 자동으로 발급하고 서명 헤더 이름과 알고리즘(`sha256`·`sha512`)을 받는다.
- REQ-AUTHCFG-006 WHEN 사용자가 IP Whitelist 를 입력하면 THE SYSTEM SHALL 모든 유형에서 한 줄에 IP 나 CIDR 하나씩 받아 저장한다. (원본: NAV-CA-05)
- REQ-AUTHCFG-007 IF IP Whitelist 항목이 단일 IP 나 CIDR(IPv4·IPv6) 형식이 아니면 THE SYSTEM SHALL 생성·수정을 400 으로 거부한다.
- REQ-AUTHCFG-008 WHEN 사용자가 인증 설정 행을 누르면 THE SYSTEM SHALL 최근 호출 시각·총 호출 수·기간별 호출 수·최근 20건 호출 이력을 사용 내역으로 보여 준다. (원본: NAV-CA-06)
- REQ-AUTHCFG-009 WHEN 기간별 호출 수를 계산하면 THE SYSTEM SHALL 최근 24시간·7일·30일 롤링 윈도로 세고 막대 차트로 표시한다.
- REQ-AUTHCFG-010 WHEN 사용 내역의 호출 이력을 그리면 THE SYSTEM SHALL 소스 IP 가 없으면 `—` 를, 응답 코드가 없으면 실행 상태 값을 대신 표시한다.
- REQ-AUTHCFG-011 WHEN 인증 설정을 응답하면 THE SYSTEM SHALL `config.key`·`config.token`·`config.secret`·`config.password` 를 `***<last4>` 로 가리고 `username`·`header`·`headerName`·`algorithm` 은 평문으로 싣는다.
- REQ-AUTHCFG-012 IF 가릴 값이 네 글자보다 짧으면 THE SYSTEM SHALL `***` 만 싣는다.
- REQ-AUTHCFG-013 WHEN 인증 설정을 만들거나 재생성하면 THE SYSTEM SHALL 발급한 평문을 그 응답에 한 번만 싣는다.
- REQ-AUTHCFG-014 WHEN 관리자 이상이 평문 보기를 요청하면 THE SYSTEM SHALL 현재 로그인 비밀번호를 다시 확인한 뒤 평문 config 전체를 한 번 응답하고 감사 로그에 `auth_config.reveal` 을 남긴다.
- REQ-AUTHCFG-015 IF 평문 보기 요청의 비밀번호가 틀리면 THE SYSTEM SHALL 401 로 거부한다.
- REQ-AUTHCFG-016 WHEN 화면이 생성·재생성·평문 보기로 받은 평문을 표시하면 THE SYSTEM SHALL 30초 뒤 자동으로 지우고 컴포넌트가 사라질 때 타이머를 정리한다.
- REQ-AUTHCFG-017 WHEN 사용자가 키·토큰 복사 버튼을 누르면 THE SYSTEM SHALL 마스킹된 문자열을 복사한다.
- REQ-AUTHCFG-018 WHEN 관리자 이상이 편집 폼을 저장하면 THE SYSTEM SHALL 이름·IP Whitelist·비밀이 아닌 config(`headerName`·`header`·`algorithm`·`username`)만 바꾼다.
- REQ-AUTHCFG-019 WHEN 편집 PATCH 가 config 를 받으면 THE SYSTEM SHALL 기존 config 에 shallow-merge 하고 되돌아온 마스킹 값(`***<last4>`)은 무시해 저장된 비밀을 지킨다.
- REQ-AUTHCFG-020 IF 편집 PATCH 가 유형(`type`)이나 비밀 값(`key`·`token`·`secret`·`password`)을 실으면 THE SYSTEM SHALL 그 값을 무시하고 저장된 유형과 비밀 값을 그대로 둔다.
- REQ-AUTHCFG-021 WHEN 관리자 이상이 재생성을 확인하면 THE SYSTEM SHALL 기존 키·토큰·시크릿을 폐기하고 새 값을 발급한다.
- REQ-AUTHCFG-022 IF 편집자나 뷰어가 인증 설정 생성·수정·활성 토글·재생성·평문 보기·삭제 API 를 부르면 THE SYSTEM SHALL 403 `ADMIN_REQUIRED` 로 거부한다.
- REQ-AUTHCFG-023 WHILE 사용자가 편집자나 뷰어인 동안 THE SYSTEM SHALL 변경 액션 버튼(Add Config·활성 토글·Reveal·Edit·Regenerate·Delete)을 노출하지 않는다.
- REQ-AUTHCFG-024 WHEN 뷰어 이상이 목록·상세·사용 내역을 조회하면 THE SYSTEM SHALL 비밀 값을 가린 채 응답한다.
- REQ-AUTHCFG-025 WHEN `GET /api/auth-configs/:id/usage` 가 호출되면 THE SYSTEM SHALL `totalCalls`·`lastUsedAt`·`periodCounts`·`recentCalls`(최근 20건)를 돌려준다.
- REQ-AUTHCFG-026 WHEN 인증 설정이 복호화 불가 표식으로 읽히면 THE SYSTEM SHALL 목록·상세·편집·평문 보기 응답의 `config` 에서 원래 저장값을 빼고 표식은 남긴다.
- REQ-AUTHCFG-027 IF Basic Auth 유형 생성 요청의 `config.username` 이나 `config.password` 가 없거나 문자열이 아니거나 빈 문자열이면 THE SYSTEM SHALL 생성을 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-AUTHCFG-028 IF Basic Auth 인증 설정의 편집 PATCH 가 `config.username` 을 싣고 그 값이 문자열이 아니거나 빈 문자열이면 THE SYSTEM SHALL 수정을 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-AUTHCFG-029 IF Basic Auth 인증 설정에 재생성을 요청하면 THE SYSTEM SHALL 설정을 저장하지 않고 감사 로그도 남기지 않은 채 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 로 거부한다.
- REQ-AUTHCFG-030 WHEN 복호화 불가 표식으로 읽히는 API Key·Bearer Token·HMAC 인증 설정에 재생성을 요청하면 THE SYSTEM SHALL 표식을 버리고 생성 때와 같은 기본값으로 새 config 를 만들어 저장한 뒤 새 값을 한 번 평문으로 응답한다.
- REQ-AUTHCFG-031 WHILE 인증 설정이 복호화 불가 표식으로 읽히는 동안 THE SYSTEM SHALL 편집 PATCH 의 `config` 를 병합하지 않고 이름·IP Whitelist·활성 상태만 바꾼다.
- REQ-AUTHCFG-032 IF 생성 요청이나 편집 PATCH 의 `config` 최상위 키 중 `__` 로 시작하는 키가 있으면 THE SYSTEM SHALL 요청을 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-AUTHCFG-033 WHILE 인증 설정의 유형이 Basic Auth 인 동안 THE SYSTEM SHALL 그 행의 ⋮ 메뉴에 Regenerate 를 노출하지 않는다.
- REQ-AUTHCFG-034 WHEN 화면이 복호화 불가 표식으로 읽히는 인증 설정 행을 그리면 THE SYSTEM SHALL 행에 «읽을 수 없음» 표시를 붙이고 재생성 확인 대화상자에 새 값과 기본 헤더·알고리즘으로 다시 만든다는 안내를 싣는다.

## 하위 문서

- [외부 호출 인증 설정 — 입력 항목 · 편집 · 재생성](CLE-TRIG-AUTHCFG-EDIT.md): 인증 방식별 입력 항목과 IP Whitelist, 편집 PATCH 의 범위 · 검증, 재생성과 복호화 불가 설정의 편집 · 재생성. 요구사항 REQ-AUTHCFG-002 · 003 · 004 · 005 · 006 · 007 · 018 · 019 · 020 · 021 · 027 · 028 · 029 · 030 · 031 · 032 · 033 · 034(재생성 확인 대화상자 안내 부분)
- [외부 호출 인증 설정 — 마스킹과 평문 보기](CLE-TRIG-AUTHCFG-REVEAL.md): 필드 마스킹 규칙, 평문이 나가는 세 경로, 평문 보기 흐름과 30초 자동 숨김, 복호화 불가 표식의 응답과 «읽을 수 없음» 행 표시. 요구사항 REQ-AUTHCFG-011 · 012 · 013 · 014 · 015 · 016 · 017 · 026 · 034(행 표시 부분. 재생성 확인 대화상자 안내는 입력 항목 · 편집 · 재생성 문서)

## 화면 구조

인증 설정 화면은 헤더와 인증 설정 목록으로 이루어진다. 행을 누르면 사용 내역 드로어가 열린다.

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 헤더 | 맨 위 | 제목 "Authentication", "+ Add Auth Method" 버튼 | 버튼은 관리자 이상에게만 보인다. 누르면 생성 폼이 열린다 |
| 인증 설정 목록 | 본문 | 행마다 이름, 유형, 활성 상태, 최근 사용 시각, 더보기(⋮). 복호화 불가 표식으로 읽히는 행에는 «읽을 수 없음» 표시 | 행을 누르면 [사용 내역](#사용-내역) 드로어가 열린다(모든 역할). ⋮ 메뉴의 변경 액션은 관리자 이상에게만 보인다. Basic Auth 행에는 Regenerate 가 없다 |

목록 행 예시는 다음과 같다.

| 이름 | 유형 | 상태 | 둘째 줄 |
|------|------|------|---------|
| 🔑 Production API Key | API Key | Active | Last used: 2 hours ago |
| 🔑 Staging Token | Bearer | Active | Last used: 1 day ago |
| 🔑 Legacy Basic Auth | Basic Auth | Inactive | Last used: 30 days ago |

## 인증 방식별 입력 항목

→ [입력 항목 · 편집 · 재생성 「인증 방식별 입력 항목」](CLE-TRIG-AUTHCFG-EDIT.md#인증-방식별-입력-항목)

### Basic Auth

→ [입력 항목 · 편집 · 재생성 「Basic Auth」](CLE-TRIG-AUTHCFG-EDIT.md#basic-auth)

## 편집

→ [입력 항목 · 편집 · 재생성 「편집」](CLE-TRIG-AUTHCFG-EDIT.md#편집)

## 재생성

→ [입력 항목 · 편집 · 재생성 「재생성」](CLE-TRIG-AUTHCFG-EDIT.md#재생성)

## 사용 내역

인증 설정 행을 누르면 그 인증 설정을 쓴 호출의 사용 내역을 보여 준다. 트리거 화면의 호출 이력과는 다른 화면이다([트리거 관리](CLE-TRIG-MANAGE.md)).

| 항목 | 설명 |
|------|------|
| 최근 호출 시각 | 마지막 사용 시각(`lastUsedAt`). 웹훅 인증이 성공하면 갱신한다 |
| 총 호출 수 | 이 인증 설정에 연결된 트리거의 누적 실행 수(`totalCalls`) |
| 기간별 호출 수 | 최근 24시간·7일·30일 롤링 윈도 기준 호출 수(`periodCounts { last24h, last7d, last30d }`). `Execution.started_at` 을 한 쿼리 안에서 조건부 집계(`COUNT(*) FILTER`)한다. 화면은 막대 차트(recharts BarChart)로 그린다. 일·주·월 경계로 나누는 캘린더 버킷이 아니라 호출 시점 기준 롤링 윈도다 |
| 호출 이력 테이블 | 최근 20건. 대상 트리거 이름, 상태, 소스 IP, 응답 코드, 시각(`recentCalls` 의 `triggerName` / `status` / `sourceIp` / `responseCode` / `startedAt`). 소스 IP 가 없는(HTTP 가 아닌 트리거) 행은 `—` 로, 응답 코드가 없는 행은 워크플로우 실행 `status` 값으로 대신 표시한다 |

소스 IP(`Execution.source_ip`)와 응답 코드(`Execution.response_code`)를 어떻게 잡아 저장하는지는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 이 정한다. 집계는 `Execution.trigger_id → Trigger.auth_config_id` 조인으로 한다.

## 필드 마스킹과 평문 보기

→ [마스킹과 평문 보기](CLE-TRIG-AUTHCFG-REVEAL.md)

### 마스킹 규칙

→ [마스킹과 평문 보기 「마스킹 규칙」](CLE-TRIG-AUTHCFG-REVEAL.md#마스킹-규칙)

### 평문 보기 흐름

→ [마스킹과 평문 보기 「평문 보기 흐름」](CLE-TRIG-AUTHCFG-REVEAL.md#평문-보기-흐름)

## 권한

목록의 모든 변경 액션 버튼(헤더의 Add Config, 활성 토글(Activate/Deactivate), Reveal, Edit, Regenerate, Delete)은 관리자 이상에게만 보인다. 편집자와 뷰어는 마스킹된 목록·상세·사용 내역(읽기)만 본다. 목록 행 클릭(사용 내역 드로어 = 읽기)은 모든 역할에게 허용해 가드하지 않는다.

편집자나 뷰어가 변경 API 를 직접 부르면 403 `ADMIN_REQUIRED` 다(`RolesGuard` 의 `@Roles('admin')`). 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 의 권한 매트릭스다(인증 설정: 소유자·관리자 = CRUD, 편집자·뷰어 = 읽기). 화면 가드는 일관성과 403 혼란 방지용이고 실제 인가는 백엔드 `@Roles('admin')` 가 fail-closed 로 강제한다(이중 방어). `useHasRole("admin")` 은 `ROLE_LEVEL` 이상 비교라 소유자도 포함한다.

## API

변경(POST / PATCH / DELETE / regenerate / reveal)은 관리자 이상, 조회(GET 목록·상세·usage)는 뷰어 이상이다. 목록 응답 형식은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 목록 응답 규칙을 따른다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/auth-configs` | 인증 설정 목록. 쿼리: `page`, `limit`, `sort`, `order`, `search` |
| POST | `/api/auth-configs` | 인증 설정 생성(관리자 이상). 자동 발급한 값을 한 번 평문으로 응답한다 |
| GET | `/api/auth-configs/:id` | 상세 |
| PATCH | `/api/auth-configs/:id` | 수정: 이름·IP Whitelist·비밀이 아닌 config·활성 토글(관리자 이상) |
| POST | `/api/auth-configs/:id/regenerate` | 키·토큰·시크릿 재생성. 새 값을 한 번 평문으로 응답한다(관리자 이상). Basic Auth 는 400 `AUTH_CONFIG_REGENERATE_UNSUPPORTED` 다 |
| POST | `/api/auth-configs/:id/reveal` | 평문 config 한 번 노출. `:id` 는 UUID, 본문 `{ password }`. 관리자 이상. 감사 로그 기록 |
| DELETE | `/api/auth-configs/:id` | 삭제(관리자 이상) |
| GET | `/api/auth-configs/:id/usage` | 사용 내역. 응답 `data`: `{ totalCalls, lastUsedAt, periodCounts: { last24h, last7d, last30d }, recentCalls: [{ id, triggerName, status, sourceIp, responseCode, startedAt }] }`(최근 20건) |

인증 설정을 지우면 연결된 트리거의 `auth_config_id` 는 FK SET NULL 로 끊긴다([트리거 데이터와 흐름](CLE-TRIG-DATA.md)).

생성·수정의 입력 검증 실패는 400 `VALIDATION_ERROR` 이고 `details` 는 배열 `[{ field, message, code: 'INVALID_FIELD' }]` 다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 요청 형식 검증(IP Whitelist 형식 등)과 서비스가 하는 검증(Basic Auth 빈 값, `__` 키)의 `details` 가 같은 모양이다. Basic Auth 빈 값의 `field` 는 `config.username`·`config.password` 이고 `__` 키의 `field` 는 `config.<키>` 다. 틀린 필드가 여럿이면 모두 싣는다.

## 미결 사항

현재 없다.

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/authentication/**`
- `codebase/backend/src/modules/auth-configs/**`

## Rationale

하위 문서로 옮긴 결정의 근거는 각 하위 문서의 Rationale 에 있다. 입력 항목 · 편집 · 재생성 쪽(Bearer Token 자동 발급, 편집 폼의 비밀 재입력, Basic Auth 빈 값 거부 두 결정, 복호화 불가 설정의 재생성 · 편집, Basic Auth 재생성 거부, `__` 키 거부)은 [입력 항목 · 편집 · 재생성 「Rationale」](CLE-TRIG-AUTHCFG-EDIT.md#rationale), 마스킹 · 평문 보기 쪽(평문 30초 자동 숨김, 복호화 불가 표식과 원래 저장값 제거)은 [마스킹과 평문 보기 「Rationale」](CLE-TRIG-AUTHCFG-REVEAL.md#rationale)에 있다. 다른 문서가 이 문서의 앵커로 가리키는 두 절은 아래에 링크로 남긴다.

### 인증 설정을 웹훅 수신 인증에 연결한 결정

인증 메뉴의 인증 설정은 웹훅 수신 인증에 연결된다. 트리거 인라인 인증 경로를 없애고 인증 설정 하나로 모은 근거는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 "인라인 인증 경로 폐지" 결정에 있다. 이 결정에 딸린 인증 설정 쪽 결정은 다음과 같다.

- HMAC 유형: API Key·Bearer·Basic Auth 에 더해 `hmac` 을 지원한다. 웹훅 HMAC 서명 검증을 트리거 인라인 `config.secret` 대신 인증 설정이 맡는다.
- Bearer Token 만료 필드를 v1 에서 뺐다: 토큰 만료와 자동 회전을 다루지 않는다. JSONB 스키마 `{ token }` 과 맞춘 것이다. 만료나 회전이 필요해지면 후속 결정으로 다시 들인다.
- 항상 마스킹하고 평문 보기 엔드포인트를 둔다: API 응답에서 비밀 값은 늘 `***<last4>` 다. 평문은 생성·재생성·평문 보기 세 경로에서만 나간다. 평문 보기는 관리자 이상, 비밀번호 재확인, 감사 기록을 요구한다.

### 변경 액션 버튼을 모두 관리자 이상으로 가드하는 이유

전에는 Reveal 만 관리자 이상으로 가드했다. 이 비대칭을 없애 Add Config·활성 토글·Edit·Regenerate·Delete 까지 모든 변경 버튼을 관리자 이상에게만 보인다. 권한 매트릭스가 인증 설정을 소유자·관리자 = CRUD, 편집자·뷰어 = 읽기로 정하므로 활성 토글도 수정에 해당해 관리자 이상이다. "활성/비활성 전환은 단순 상태라 편집자도 된다" 로 새지 않게 적어 둔다. 화면 가드는 권한 상승 방지가 아니라 관리자가 아닌 사용자에게 403 이 날 버튼을 감춰 혼란을 없애는 일관성 장치다. 실제 인가는 [권한](#권한) 의 백엔드 가드가 맡는다.

### 사용 내역을 실행 행에 저장하는 이유

사용 내역의 소스 IP·응답 코드·기간별 호출 수는 다음 결정으로 구현했다. 컬럼 정의는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 이 정본이다.

- 저장 위치는 실행(`Execution`) 행에 컬럼을 더하는 것이고(V096) 전용 호출 로그 엔티티는 두지 않는다. 인증 설정 사용 집계는 이미 `Execution.trigger_id → Trigger.auth_config_id` 조인으로 `totalCalls`/`recentCalls` 를 냈다. 같은 행에 `source_ip VARCHAR(45)`·`response_code VARCHAR(10)`(둘 다 nullable)을 더하면 조인 한 번으로 끝나 가장 단순하다. 통합은 전용 `IntegrationUsageLog` 를 두지만 인증 설정은 호출이 곧 워크플로우 실행이라 실행 행을 단일 기준으로 다시 쓴다. 별도 로그를 두면 이중 기록과 정합 부담이 생긴다.
- 응답 코드는 두 가지를 함께 쓴다. 웹훅과 채팅 채널 inbound 는 호출이 받은 실제 HTTP 코드를 저장한다. 실행 생성에 성공한 경로는 `202 Accepted` 다. 다만 채팅 채널의 인터랙션 요청(Discord 슬래시 명령·컴포넌트·모달 제출, Slack Interactivity)에는 3초 안에 `200` 인터랙션 응답으로 답하므로 `200` 을 저장한다. 이 응답 계약은 [채팅 채널 공통](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다. 인증 401·검증 400·비활성 410 은 `execute` 전에 던져져 실행 행이 생기지 않는다. 스케줄 같은 HTTP 가 아닌 트리거는 `response_code` 가 NULL 이고 `getUsage` 가 워크플로우 실행 `status` 값으로 대신 표시한다. 이렇게 WH-MG-05 의 "응답 코드 확인" 을 이행한다. 이 요구를 어느 화면이 이행하는지는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 미결 사항에 적는다.
- 기간별 호출 수는 롤링 윈도(24h·7d·30d)와 막대 차트로 한다. 사용 내역 화면의 목적은 최근 활동량 파악이고 캘린더 버킷의 경계 정렬(시간대, 주 시작 요일) 모호성도 피한다. `Execution.started_at` 을 한 쿼리에서 조건부 집계(`COUNT(*) FILTER (WHERE started_at >= now()-window)`)해 왕복 한 번으로 세 값을 구한다.
- 소스 IP 는 `hooks.service` 가 웹훅 진입 때 `extractClientIpFromHeaders` 로 뽑은 값을 인증 IP whitelist 검증과 호출 기록에 함께 쓴다. `CF-Connecting-IP` 를 신뢰하도록 설정했으면 그 값, 아니면 `X-Forwarded-For` 첫 IP 를 쓰고 헤더 기반이라 `req.ip` 폴백은 없다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 클라이언트 IP 항목). 뽑지 못하면 NULL 이다.

### Basic Auth 재생성을 거부한다 (2026-11-05)

→ [입력 항목 · 편집 · 재생성 「Basic Auth 재생성을 거부한다」](CLE-TRIG-AUTHCFG-EDIT.md#basic-auth-재생성을-거부한다-2026-11-05)

### 복호화 불가 표식을 응답에 그대로 둔다 (2026-11-05)

→ [마스킹과 평문 보기 「복호화 불가 표식을 응답에 그대로 둔다」](CLE-TRIG-AUTHCFG-REVEAL.md#복호화-불가-표식을-응답에-그대로-둔다-2026-11-05)
