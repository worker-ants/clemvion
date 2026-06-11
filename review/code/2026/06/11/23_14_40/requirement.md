# Requirement Review — SSRF Guard All-Auth (refactor 04 C-3) — 재검토

**리뷰 일시**: 2026-06-11
**대상 변경**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**대상 파일**:
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `review/code/2026/06/11/23_00_44/` 산출물 전체 (이전 세션 리뷰 결과)

---

## 발견사항

### [INFO] 핵심 기능 요구사항 — 완전 구현 확인

spec `§4 step 8`이 요구하는 "SSRF 가드 전 인증 방식 공통 적용"이 `http-request.handler.ts` line 334–375 의 unconditional SSRF guard try-catch 블록으로 정확히 구현됐다. `if (authentication === 'integration')` 게이트가 제거되어 `none` / `custom` / `integration` 모두 `assertSafeOutboundUrl` + `assertSafeOutboundHostResolved` 를 거친다. spec §4 step 8 행위 명세와 코드 구현이 line-level 로 일치한다.

---

### [INFO] configEcho 명시 열거 — spec §4 step 2 / Principle 7 D1 완전 일치

spec `§4 step 2`가 요구하는 "명시 열거(spread 금지), 스키마 정의 12개 필드 직접 참조"가 handler line 163–176 에 정확히 구현됐다. 스키마 필드 (`method`, `url`, `authentication`, `integrationId`, `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl`) 12개가 모두 명시 열거됐으며, `url` 만 `sanitizeUrlCredentials` 결과로 교체된다. spec 요구와 line-level 일치.

---

### [INFO] Usage 로깅 매트릭스 — spec §4.2 일치

handler line 349–361 의 `if (authentication === 'integration' && integrationId)` 조건으로 SSRF 차단 시 logUsage 를 integration 인증에만 한정한다. spec `§4.2` Usage 로깅 매트릭스("SSRF 차단 / redirect 한도 초과 → `failed` / `HTTP_BLOCKED`") 는 authentication='integration' 전제이며 none/custom 은 활동 로그 미생성으로 명시돼 있어 line-level 일치.

---

### [INFO] error-codes.ts HTTP_BLOCKED 등재 — spec §5.8 / §6 / error-handling.md §1.4 일치

`codebase/backend/src/nodes/core/error-codes.ts` line 14–16 에 `HTTP_BLOCKED` 가 등재됐고 주석에 "Applies to ALL auth methods (refactor 04 C-3)" 가 명시됐다. spec `§6` 에러 코드 표, `spec/5-system/3-error-handling.md §1.4` HTTP 카탈로그에도 `HTTP_BLOCKED` 가 등재돼 있어 코드-spec 일치.

**주의**: `error-codes.ts` 에 `HTTP_TIMEOUT: 'HTTP_TIMEOUT'` (line 13) 이 잔존하나 `spec/5-system/3-error-handling.md §1.4` HTTP 카탈로그에는 `HTTP_TIMEOUT` 이 여전히 열거된다. 이 항목은 본 변경 이전부터 존재하는 기존 상태이며 핸들러에서는 실제로 사용되지 않는다. 본 변경이 신규로 만든 불일치는 아니나, `HTTP_TRANSPORT_FAILED` 가 타임아웃을 흡수한다는 spec 의 실제 동작과 `HTTP_TIMEOUT` enum 잔존 간의 괴리는 별도 정리 작업 대상이다.

---

### [INFO] dry-run 시 SSRF 가드 생략 — 의도적 설계, 기능 결함 아님

handler line 320–332 의 `isDryRun(context)` 분기가 SSRF guard try-catch(line 344) 보다 앞에 위치하여 dry-run 시 가드가 생략된다. 코드 주석("We deliberately branch BEFORE the SSRF host checks ... no real request leaves the process, so those guards have nothing to protect against")이 이 동작을 명시적으로 설명한다. 실제 fetch 가 발생하지 않으므로 SSRF 보호 대상이 없어 논리적으로 타당하다. 기능 요구사항 위반이 아니다.

---

### [INFO] [SPEC-DRIFT] spec §4 step 8 에 dry-run 예외 미명문화

- 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8
- 상세: 코드는 dry-run 시 SSRF 가드를 의도적으로 건너뛰며 주석으로 명시하고 있으나, spec §4 step 8 은 이 dry-run 예외를 서술하지 않는다. 코드 동작이 합리적이고 의도적이며 되돌리는 것이 오답이다. spec 만 낡아 있다.
- 제안: 코드 유지. spec `§4 step 8` 에 "(dry-run 실행 시 실제 fetch 가 발생하지 않으므로 SSRF 가드 생략 — `spec/5-system/13-replay-rerun.md §7` 참조)" 한 줄 추가. 대상 spec: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/spec/4-nodes/4-integration/1-http-request.md` §4 step 8. 이 반영은 `project-planner` 위임 사항이며 본 reviewer 는 spec 직접 수정 금지.

---

### [WARNING] `HTTP_BLOCKED` ERROR_KO 한국어 매핑 — 이미 추가됐으나 메시지 내용 검토

이전 세션(23_00_44) 의 `user_guide_sync.md` WARNING 은 `HTTP_BLOCKED` ERROR_KO 매핑 누락을 지적했다. 본 리뷰 대상 변경에서 `backend-labels.ts` line 582–585 에 해당 매핑이 이미 추가됐다:

```
HTTP_BLOCKED:
  "보안 정책(SSRF 방지)에 의해 해당 주소로의 요청이 차단됐어요. 내부망·loopback·클라우드 메타데이터 주소는 기본 차단되며, 자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요."
```

이 메시지는 이전 세션 WARNING #7 의 요구사항을 충족한다. 단, 메시지 길이가 매우 길고 기술적 env var 이름을 사용자에게 노출한다. 이는 최종 사용자가 아닌 워크플로 작성자·운영자를 대상으로 한 메시지로 판단되므로 내용은 수용 가능하다. UX 정책이 최종 사용자 노출을 제한한다면 별도 검토가 필요하나, 현재 spec 에 제한 규정 없음.

---

### [INFO] configEcho 주석 — 이전 세션 WARNING #5 해소 확인

이전 세션(23_00_44) WARNING #5 에서 지적한 "adding a new schema field is automatically echoed without a maintenance step here" 모순 구절이 본 변경에서 제거됐다. diff 에서 해당 행(-154 to -157)이 삭제되고 "NOTE: adding a new schema field (http-request.schema.ts) requires adding it here too" 로 교체됐다. WARNING #5 요구사항 해소 완전.

---

### [INFO] SSRF 가드 블록 주석 — 이전 세션 WARNING #6 해소 확인

이전 세션(23_00_44) WARNING #6 에서 지적한 내부 검토 태그 `(W-4)` 가 본 변경에서 제거됐다. diff 에서 `(W-4)` 참조 행(-52 to -54)이 삭제되고 "DNS rebinding 시나리오에 무방어다" 로 재서술됐다. WARNING #6 요구사항 해소 완전.

---

### [INFO] integrationId 미설정 엣지 케이스 — 기능 결함 없음

`authentication === 'integration'` 이지만 `integrationId` 가 undefined 인 경우, SSRF 가드에 도달하기 이전에 integration credential 해석 단계(line 189–238) 에서 `INTEGRATION_SERVICE_UNAVAILABLE` 또는 `INTEGRATION_CALL_FAILED` 로 이미 분기한다. 따라서 실제로 SSRF 가드 catch 에서 `integrationId === undefined` 인 상황은 발생하지 않는다. 기능 완전성 이상 없음.

---

## Spec Fidelity 분석

### spec §4 단계별 구현 일치 점검

| spec §4 step | 구현 상태 | 비고 |
|---|---|---|
| step 1 Config 정규화 | 일치 | method 대문자, bodyType/responseType 기본값 적용 |
| step 2 configEcho 명시 열거 | 일치 | 12개 필드 명시, url sanitize 적용 |
| step 3 Integration 자격증명 해석 | 일치 | integration 인증만, D4 error 포트 라우팅 |
| step 8 SSRF 가드 전 인증 공통 | 일치 | 게이트 제거, 2-layer 검증, ALLOW_PRIVATE_HOST_TARGETS opt-out |
| step 8 dry-run 예외 | 코드 구현됨 / spec 미명문화 | [SPEC-DRIFT] — 코드 정합, spec 갱신 필요 |
| §4.2 Usage 로깅 integration 한정 | 일치 | catch 블록 authentication 조건 일치 |
| §5.3 HTTP_BLOCKED error 포트 라우팅 | 일치 | buildPreflightErrorOutput 호출 |
| §6 에러 코드 목록 | 일치 | error-codes.ts 등재 + 3-error-handling.md §1.4 등재 |

### 이전 리뷰 세션 지적사항 반영 현황

| 이전 세션 항목 | 반영 상태 |
|---|---|
| WARNING #5 configEcho 주석 모순 구절 | 해소 완전 |
| WARNING #6 (W-4) 내부 태그 제거 | 해소 완전 |
| WARNING #7 HTTP_BLOCKED ERROR_KO 누락 | 해소 완전 (backend-labels.ts 에 추가됨) |

---

## 요약

핵심 기능 요구사항 전항목(SSRF 가드 전 인증 방식 공통 적용, configEcho 명시 열거, HTTP_BLOCKED 에러코드 등재, ERROR_KO 한국어 매핑)이 완전히 구현됐다. spec §4 step 8, §4.2, §5.3, §6 및 `3-error-handling.md §1.4` 와 코드 구현이 line-level 로 일치한다. 이전 리뷰 세션(23_00_44) 의 WARNING #5, #6, #7 이 모두 본 변경에서 해소됐다. 발견사항은 INFO 4건(기능 완전성 이상 없음), SPEC-DRIFT 1건(dry-run 예외를 spec §4 step 8 에 명문화 필요 — 코드 동작이 합리적이고 의도적이며 되돌리는 것이 오답)이다. `HTTP_TIMEOUT` enum 잔존은 본 변경 이전부터 존재하는 기존 상태이며 본 변경이 신규로 유발한 결함이 아니다.

---

## 위험도

**LOW**

INFO 4건, SPEC-DRIFT 1건(spec 갱신 필요, 코드 정합). 기능 요구사항 충족 완전. 이전 세션 WARNING 3건 해소 확인.

---

STATUS: OK
