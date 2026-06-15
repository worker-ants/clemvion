# RESOLUTION — fresh ai-review 12_29_50 (A-2, resolution 후 재검토)

RISK **MEDIUM** (기능 결함 W1 포함) · Critical **0** · Warning **6** · INFO 17. 수동 resolution.
fix commits: `2eab022a` (code), `744c6509` (spec).

## 조치 항목

| # | 분류 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | 기능 결함 | `validateFileField` 가 `File.type === ''`(빈 MIME) 을 미허용으로 거부 — 클라이언트는 skip(통과)이라 서버/클라 불일치 | MIME 체크에 `m.type !== ''` 추가(클라와 대칭, 신뢰 불가 metadata skip). 단위 테스트 추가 | 2eab022a |
| W2 | 아키텍처/유지보수 | DEFAULT_FILE_* 상수 backend/frontend 중복 | **accept** — spec §1 SoT, CSR 번들 분리로 backend 모듈 직접 import 불가. frontend JSDoc 근거 보강. 공유 패키지 추출은 B-1 백로그 | 2eab022a |
| W3 | 아키텍처 | 검증 경로 이원화(validateFormSubmission vs execution-engine 루프) | execution-engine 단일 패스 루프를 `validateAllFields(formData, defs, coerceScalar)` 순수 함수로 추출(file/scalar dispatch 단일 진입점) + 단위 테스트 3건 | 2eab022a |
| W4 | 문서/사실 | MIME 기본 목록 "13종" 표기 오류(실제 14종) — 코드 2곳·spec 4곳 | 코드(types.ts·dynamic-form-ui.tsx) "14종" 수정. spec 4곳도 정정 | 2eab022a / 744c6509 |
| W5 | 테스트 | frontend useT i18n locale 암묵 의존 | dynamic-form-ui.test 에 locale ko 고정 beforeEach(모듈 store 잔류 방어) | 2eab022a |
| W6 | 유지보수 | renderField 파라미터 6개(file 전용 onError/t 누수) | renderFileField 분리 → renderField scalar 전용 4-param 환원 | 2eab022a |
| I1 | SPEC-DRIFT | spec "13종"→14종 | W4 와 동일 조치(spec 4곳) | 744c6509 |
| I2 | SPEC-DRIFT | EIA §5.1 file "Planned" 잔존 | "Planned" 제거 + file 항목 추가 | 744c6509 |
| I3 | SPEC-DRIFT | WS §4.2 file 미열거 | file MIME/크기/개수 열거 추가 | 744c6509 |
| I4 | SPEC-DRIFT | §1.5 `multiple` 스니펫 구현과 상이 | `(maxFiles ?? 1) > 1` 로 정렬(1차 resolution 에서 조치, 본 PR 반영 확인) | 062bd3e1 |
| I6 | 보안 | 클라 MIME 우회 가능(설계상 UX 가드) | validateFilesClient JSDoc 에 "UX 가드 전용·보안 게이트 아님" 명시 | 2eab022a |
| I7 | 아키텍처 | FIRST 오류 순서 계약 JSDoc 의존 | validateFileField/validateFilesClient JSDoc 에 순서 이미 명시(MIME→size→total→count) | (기존) |
| I8 | 유지보수 | posFinite 인라인 람다 | 모듈 상단 `isPositiveFinite` 로 분리 | 2eab022a |
| I9 | 유지보수 | `prev[name] === undefined` → `!(name in prev)` | 변경 | 2eab022a |
| I12 | 문서 | FormField maxFileSize/maxTotalSize 단위 미주석 | MB 단위 주석 추가 | 2eab022a |
| I13 | 문서 | coerceFormValue "file 메타" 잔존 주석 | scalar 전용 명시로 수정 | 2eab022a |

## accept / defer (조치 안 함)

| # | 분류 | 사유 |
|---|---|---|
| I5 | 보안 | image/svg+xml 기본 허용 — metadata-only 라 현 무위험. 파일 서빙 surface 도입 시 CSP/별 origin(향후) |
| I10 | 유지보수 | validateFilesClient 빈 배열 조기반환 — required 는 HTML native + 서버가 게이트. 의도 자명, defer |
| I11 | 문서 | @returns JSDoc — 본문에 "FIRST 오류 반환, 통과면 null" 이미 명시. 저가치, defer |
| I14 | 테스트 | file required 미제출 통합 케이스 — 단위(validateFileField required)로 커버. defer |
| I15 | 테스트 | multiple attribute 분기 테스트 — 기존 file 테스트가 maxFiles 1/3 multiple 단언 이미 포함 |
| I16/I17 | 성능 | 파일 3회 순회·extractFormFields 재파싱 — maxFiles≤5·순수 메모리, 무시 가능 |

## TEST 결과

- lint: 통과 (eslint --fix 무관 3파일 git checkout revert; idCoerce no-base-to-string 1건 fix)
- unit: 통과 (backend form-mode 441 / 40 suite, frontend 17 dynamic-form-ui. status-badge humanizeUntil flaky → 재실행 PASS, 본 diff 무관)
- build: 통과
- e2e: 통과 (192)

## 보류·후속 항목

- W2 공유 패키지 추출 → 아키텍처 백로그 **B-1**(검증 로직 채널 중립 승격)에 통합 추적.
- I5(파일 서빙 보안)·B-1 은 해당 surface 도입 시.
