# RESOLUTION — ai-review 12_56_24 (A-2, 인접 spec sync 후 재검토)

RISK **LOW** · Critical **0** · Warning **2** · INFO 6. 수동 resolution.
fix commit: `463ce5bf`.

> **router 주의**: 본 세션의 router 가 changeset 을 "spec·review 문서만" 으로 오판해 코드 reviewer
> (security/architecture/testing/maintainability/side_effect 등)를 제외했다. 그러나 branch diff 에는
> 2차 resolution 코드(2eab022a: form-mode `validateAllFields`/빈 MIME 수정·renderFileField)가 포함된다.
> 이 코드를 코드 reviewer 가 실제로 보도록 **최종 `/ai-review --route=all` 재검토**를 후속 실행한다.

## 조치 항목

| # | 분류 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | 요구사항 | form §6.2 minLength/maxLength 행이 `validation.message` 사용 약속 vs 구현 하드코딩 기본 메시지 → §1.5 callout 과 spec 내부 모순 | **option B** — §6.2 를 "기본 메시지 사용(message override 향후 과제)" 로 갱신. pre-existing scalar 갭(A-2 이전, #608/#610 부터)을 정직하게 정정 | 463ce5bf |
| W2 | 문서화 | WS §4.2 `VALIDATION_ERROR` 에 `type:'file'` 미반영 | **false positive** — 744c6509 에서 이미 추가됨(현재 line 313 에 "`type:'file'` MIME·크기·개수" 존재). 리뷰 changeset 부분 인식으로 인한 오탐 | (이미 744c6509) |
| INFO#1 | 요구사항 | `multiple` 표현식 코드 vs spec literal 형식 불일치(기능 동치) | dynamic-form-ui `multiple={(field.maxFiles ?? 1) > 1}` 로 정렬 | 463ce5bf |

## accept / defer

| # | 분류 | 사유 |
|---|---|---|
| INFO#2 | 요구사항 | validateFilesClient required 빈 배열 미처리 — required 빈 file 은 서버(`validateFileField` required)가 게이트 + HTML native. UX 개선은 선택, defer |
| INFO#3 | 문서 | spec §1.5 i18n 키 명시 — spec↔frontend impl 키 결합 회피(코드 JSDoc 에 4개 키 이미 명시). defer |
| INFO#4 | 문서 | spec §1 B-1 백로그 inline — 백로그는 plan 도메인(RESOLUTION/plan 에 기록). spec 본문 미기재 |
| INFO#5/#6 | 문서 | validateFilesClient/validateFileField JSDoc — 이미 @param 의미·검증 순서·상수 의존·반환 조건 명시돼 있음(확인). 추가 불필요 |

## TEST 결과

- lint: 통과 (eslint --fix 무관 3파일 revert)
- unit: 통과 (40 suite, frontend dynamic-form-ui 17)
- build: 통과
- e2e: 통과 (192)

## 보류·후속 항목

- 최종 `/ai-review --route=all` (463ce5bf 커버, 코드 reviewer 강제) — 본 RESOLUTION 직후 실행, clean 확인 후 push.
- W2 상수 공유 패키지·validation.message override 는 아키텍처 백로그 B-1 / 향후 과제.
