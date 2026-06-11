# RESOLUTION — 23_14_40 (증분 리뷰: fix 커밋 961f79a5 범위)

리뷰 세션 `review/code/2026/06/11/23_14_40/` (range `429d32d5..HEAD` — ai-review/impl-done fix).
위험도 **MEDIUM · Critical 0 · Warning 3 · INFO 24**. 본 RESOLUTION 으로 종결.

> 본 PR 리뷰 체인: `23_00_44`(전체 branch, MEDIUM/0C/7W → fix `961f79a5`: W5 주석모순·W6 W-4 태그·W7 i18n)
> → **`23_14_40`(증분, MEDIUM/0C/3W)**. 23_00_44 의 W5/W6/W7 해소 확인됨(reviewer 명시).
> 동시 `--impl-done`(`review/consistency/2026/06/11/23_14_40/`) — 별도 처분.

## Warning 처분

| # | 카테고리 | 처분 | 근거 |
| --- | --- | --- | --- |
| W1 | 보안(정보노출) | **후속 분리** | SSRF 에러 메시지에 차단 hostname/IP 포함(`http-safety.ts:107/147`) — **선재**(C-3 이전부터 동일 메시지). 대상은 워크플로 작성자 *자신*이 입력한 요청 URL 이라 정찰 가치 낮음. 클라이언트 일반화 메시지 + 서버 상세 로그 분리는 http-safety 공용 경로(HTTP/DB/Email 공유) 변경이라 별 PR. `http-ssrf-all-auth-followups.md`. |
| W2 | 보안(런타임) | **수용(설계)** | `ALLOW_PRIVATE_HOST_TARGETS` 매 호출 `process.env` 재평가(`http-safety.ts:80-82`) — **선재** + **의도된 런타임 토글성**(opt-out 을 재시작 없이 반영). `process.env` 조작 가능한 코드주입은 이미 상위 위협(별 방어면). 시작시 1회 상수화는 토글성 상실 트레이드오프라 후속 검토. |
| W3 | 부작용(breaking) | **수용(문서화)** | none/custom→사설망 차단은 **의도된 secure-by-default breaking change**. spec §8.2 Rationale·plan ⚠️ callout·커밋 메시지·PR 본문·`backend-labels HTTP_BLOCKED`(opt-out 힌트 포함)에 명시. §105 가 이미 명문화한 정책의 enforcement. |

## INFO 처분 (요약)
- **I6 (SPEC-DRIFT, dry-run SSRF skip §4 step8 미명문화)**: 코드 정확(dry-run 은 fetch 없어 가드 무의미) — spec 1줄 보강은 후속 plan(planner).
- **I3/I8/I10 (redirect 재검증 none/custom 비대칭·SSRF 차단 로깅 공백·i18n 환경변수명 노출)**: none/custom 은 `redirect: 'manual'` 로 follow 안 함(SSRF 표면 없음, spec §4 step9 명문) — 비대칭은 의도. 로깅/문구는 후속.
- **I9/I18/I20 (HTTP_BLOCKED string literal→enum·error-codes 주석·플랜 태그)**: 타입안전/문서 미세 — 후속.
- **I11~I17 (테스트 교차조합·dry-run×none/custom·configEcho error경로 D1 단언)**: 핵심 보안경로(none/custom 차단·opt-out·credential-leak)는 커버됨. 조합 확장은 후속.
- **I23 (HTTP_TIMEOUT enum 잔존)**: 선재, 본 변경 외.

## TEST 결과 (961f79a5 기준)
- lint ✅ · unit ✅ (backend 6620) · build ✅ · e2e ✅ (188).

## 보류·후속 (→ `plan/in-progress/http-ssrf-all-auth-followups.md`)
SSRF 메시지 클라이언트 일반화(http-safety 공용) · §4 step8 dry-run 노트 · HTTP_BLOCKED enum 참조화 ·
테스트 교차조합/dry-run·DB_HOST_BLOCKED 신설 검토 · env-read-once 트레이드오프.
