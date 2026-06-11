# RESOLUTION — DB_HOST_BLOCKED 재리뷰 (그룹 2b, push-guard 충족용)

ai-review `07_29_27` — 직전 review-fix commit(f7e3a7db: i18n KO + MySQL 테스트 + nav 표)을
포함한 HEAD 전체 재리뷰. RISK=LOW, 0 Critical, 1 Warning.

## Warning 처리

| # | 카테고리 | 발견 | 판정 | 조치 |
|---|----------|------|------|------|
| 1 | Side Effect | DB SSRF 차단 코드가 `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED` 로 변경 — 기존에 generic 코드로 분기하던 저장 워크플로우엔 breaking | **ACKNOWLEDGED (문서화)** | 코드 변경이 아니라 의도된 동작 개선(비대칭 해소). PR 본문에 **breaking change** 로 명시한다(아래). 실제 영향면은 낮음 — "DB SSRF 차단" 이라는 드문 케이스를 generic `INTEGRATION_CALL_FAILED` 로 분기하던 워크플로우에 한정. |

### PR 본문에 포함할 breaking-change 문구
> ⚠ Breaking: Database Query 노드의 SSRF 차단 시 `output.error.code` 가
> `INTEGRATION_CALL_FAILED` → `DB_HOST_BLOCKED` 로 바뀝니다. 해당 차단 케이스를
> generic 코드로 분기하던 저장 워크플로우가 있다면 `DB_HOST_BLOCKED` 로 갱신하세요.

## INFO (follow-up / 선택)
- enum 참조화(`ErrorCode.DB_HOST_BLOCKED`) — 파일 전반이 문자열 리터럴 컨벤션(email 핸들러 대칭)이라 보류, 기존 "handler 리터럴 → ErrorCode enum 일괄 전환" follow-up 에 연계.
- catch 블록 원본 host 서버 로그 기록 — 관찰가능성 개선(클라 미노출 유지). 유용하나 본 PR 범위 밖 follow-up.
- IPv6 `::1` 테스트, classifier 단언 중복 정리, §5.3 JSON 예제, chat-channel §3.1 `DB_*` 명시 주석, EMAIL_HOST_BLOCKED KO 매핑(pre-existing gap) — 선택 개선/별도 follow-up.

이전 세션(`01_19_26`) 의 Warning(i18n KO·MySQL 테스트)은 본 commit 으로 해소됐고, 재리뷰에서
documentation/user_guide_sync NONE 으로 재확인됨. SPEC-DRIFT FP(§1.4/§3.2)도 재리뷰에서
"FALSE POSITIVE 재확인" 으로 명시됨.

## 최종 상태
build PASS · backend lint PASS · FE lint PASS · 112 unit green · 0 Critical.
유일 Warning(breaking-change)은 PR 본문 명시로 처리.
