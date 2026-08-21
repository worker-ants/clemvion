# 요구사항(Requirement) 충족 검토 — 마스킹 마커 공유 패키지 추출

## 발견사항

- **[SPEC-DRIFT] (WARNING)** `spec/5-system/14-external-interaction-api.md` R17 의 "backend SoT / 프런트 미러" 서술이 이관 후 사실과 어긋난다 — 아직 spec 이 갱신되지 않았다
  - 위치: `spec/5-system/14-external-interaction-api.md:1624` — "마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다 — 어긋나면 가드가 조용히 뚫리므로 **양쪽을 함께** 갱신한다." 및 frontmatter `code:` 목록(`spec/5-system/14-external-interaction-api.md:13`, `sanitize-error-message.ts`/`masked-markers.ts` 만 등재, `codebase/packages/masked-markers/**` 없음)
  - 상세: 이번 변경으로 마커 상수(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`)와 깊이 상한(`MAX_MASK_DEPTH`)의 실제 정의가 `codebase/packages/masked-markers/src/index.ts` 로 이동했고, backend `sanitize-error-message.ts`/frontend `masked-markers.ts` 는 재export shim 이 됐다(코드 주석은 양쪽 다 이미 "SoT 는 `@workflow/masked-markers`" 로 정확히 갱신됨 — `sanitize-error-message.ts:161`, `masked-markers.ts:4`). 그런데 spec 본문 R17 은 여전히 "backend 파일이 SoT" 라고 명시하며, "어긋나면 가드가 조용히 뚫리므로 양쪽을 함께 갱신한다"는 위험 서술 자체가 이관 후에는 성립하지 않는다(오히려 이관이 그 위험을 구조적으로 제거했다). 이 갭은 이미 인지되어 있다 — `plan/in-progress/masked-marker-shared-package.md` 의 "작업" 체크리스트에 `- [ ] **spec R17 정정 (planner 턴 필요)**` 항목이 명시적으로 걸려 있고 사유("developer 는 `spec/` read-only")도 정확하다. 즉 코드 쪽은 맞고(의도적·합리적 개선) spec 문서만 아직 못 따라간 전형적인 SPEC-DRIFT 이며, 그 처리 계획도 이미 옳게 세워져 있다 — 이 발견은 "아직 미집행" 상태를 리뷰 시점에 재확인하는 것이다.
  - 제안: 코드는 유지. `project-planner` 턴에서 `spec/5-system/14-external-interaction-api.md:1624` 의 SoT 문장을 "SoT 는 `@workflow/masked-markers`" 형태로 갱신하고(선례: `spec/conventions/interaction-type-registry.md:121` 등의 `@workflow/ai-end-reason` 갱신 패턴), frontmatter `code:` 목록에 패키지 경로를 추가한다. plan 체크리스트에 이미 있는 항목을 그대로 집행하면 된다.

- **[INFO]** `findMirrorRedeclarations` 의 SoT 자기 제외 분기가 현재 스캔 범위에서 도달 불가능(dead code) — 기능 결함은 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수 `findMirrorRedeclarations` 내 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;` 줄, 및 같은 파일 `SCAN_DIRS`/`SOT_DIR` 상수 정의부
  - 상세: `SCAN_DIRS` 는 `codebase/backend/src`, `codebase/frontend/src`, `codebase/channel-web-chat/src` 세 곳만 walk 하고, `SOT_DIR`(`codebase/packages/masked-markers`)은 이 세 트리 어디에도 속하지 않는다. 따라서 `listSourceFiles` 가 반환하는 `relPath` 는 `SOT_DIR` 로 시작할 수 없고, 함수 JSDoc 의 "(SoT 패키지 자신은 제외)"·인라인 주석 "여기 안에서는 당연히 선언한다"가 가리키는 배제 로직은 현재 입력 범위에서 절대 실행되지 않는다. 기능적으로 해가 되진 않지만(불필요한 continue 는 오탐도 미탐도 만들지 않음), 읽는 사람이 "패키지도 스캔 대상에 포함돼 있다"고 오인할 소지가 있다.
  - 제안: 현재 스코프가 의도라면(패키지 자체는 자기소유 심볼을 선언하는 게 당연하므로 스캔 자체를 배제) 주석을 "SCAN_DIRS 가 패키지 디렉터리를 포함하지 않으므로 이 분기는 방어적 no-op" 으로 명확히 하거나, 해당 `if` 를 제거해 로직을 단순화. 급하지 않음.

## 기능 완전성 · 엣지 케이스 · 반환값 검증 (실측)

- `codebase/packages/masked-markers` 패키지 신설분: `pnpm test`(jest, 17/17 pass) · `pnpm lint`(eslint, clean) · `pnpm build`(tsc, clean) 전부 통과. `dist/` 산출물이 실제로 생성되고 `node_modules/@workflow/masked-markers` 심볼릭 링크가 걸려 있어 backend/frontend 에서 정상 소비 가능함을 확인.
- `MASKED_MARKERS` 는 `Object.freeze([...])` 동결 **배열**(이전 backend 는 배열, frontend 는 `Set` 이었음)로 통일됐다. 저장소 전수 grep(`MASKED_MARKERS\.` 패턴)으로 `.has()` 등 `Set` 전용 메서드를 직접 호출하는 소비처가 없음을 확인 — 타입 변경에 따른 은닉 회귀 없음.
- `isMaskedMarker`/`hasMaskedMarkerLeaf`/`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH` 를 참조하는 5개 backend 소비 파일(`reject-masked-resubmission.ts`, `websocket.service.ts`, `interaction.service.ts` 등)과 2개 frontend 소비 파일(`rerun-modal.tsx`, `dynamic-form-ui.tsx`)이 전부 원래의 import 경로(`shared/utils/sanitize-error-message` / `@/lib/utils/masked-markers`)를 그대로 쓰고 있어 재export shim 교체로 인한 breaking change 없음을 직접 대조로 확인.
- backend 실측: `sanitize-error-message.spec.ts` + `reject-masked-resubmission.spec.ts` + `strip-external-only-fields.spec.ts` 106/106 pass. frontend 실측: `masked-marker-mirror.test.ts` + `masked-markers.test.ts` 33/33 pass(신규 미러 소멸 가드의 "실제 재선언을 지목하는가" 캐너리 fixture 포함).
- `MAX_REDACT_DEPTH = MAX_MASK_DEPTH` 지역 별칭이 `sanitize-error-message.ts:270` (`if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;`)에서 실제로 소비되는 것을 확인 — 별칭이 죽은 참조가 아님.
- `websocket.service.ts` 의 `MAX_SANITIZE_DEPTH = 10`(비교 연산자 `depth > MAX_SANITIZE_DEPTH`)은 plan 이 명시한 대로 **의도적으로 손대지 않음**을 확인 — 별개 불변식(마커가 놓이는 깊이가 11 vs 10)이며 병합하지 않은 판단이 근거와 일치.
- `.claude/test-stages.sh` `INTERNAL_PACKAGES`, `.github/workflows/packages-checks.yml` pathspec/matrix, backend·frontend `package.json` workspace 의존, backend/frontend/e2e 세 Dockerfile 의 COPY, `pnpm-lock.yaml` importer 항목 — plan 의 "등록 표면 실측 8곳" 표와 실제 diff 를 전수 대조해 8곳 모두 반영됐음을 확인. `packages-checks.yml` 의 "required check 6개" 주석도 matrix 실측 개수(6)와 일치.

## TODO/FIXME · 에러 시나리오 · 데이터 유효성

신규/변경 파일(`index.ts`, `sanitize-error-message.ts`, `masked-markers.ts`, mirror-guard 2파일) 전수 grep 결과 TODO/FIXME/HACK/XXX 없음. `isMaskedMarker` 는 `typeof v === 'string'` 가드로 비-문자열(`null`/`undefined`/`number`/`object`/`array`) 입력에 안전하게 `false` 를 반환하며, 이는 패키지 신규 spec(`index.spec.ts`)의 캐너리로 고정돼 있음(실측 통과). `scanForMarker` 는 값 검사를 깊이 검사보다 먼저 수행해 상한 경계에 놓인 치환 마커를 놓치지 않는 순서를 유지(off-by-one 회귀 없음, 기존 로직 그대로 이전).

## 이전 consistency-check(10:45:52, `--plan`) 발견사항 대비 처리 상태

- Critical(frontmatter `started`/`owner` 누락, build guard 실측 RED) — 현재 plan frontmatter 에 `started: 2026-08-21`, `owner: developer` 가 존재하고 `worktree:` 도 bare 디렉토리명(`masked-marker-contract-7d2e14`)으로 정정됨. 해소 확인.
- WARNING(spec R17 SoT stale, 트래커 미참조) — plan 본문에 "다른 plan 과의 관계" 절이 추가되고 정본 트래커 `spec-sync-external-interaction-api-gaps.md:373`·`:757` 두 항목이 `[x]` + 대체 근거로 갱신됨을 확인. spec R17 자체는 위 SPEC-DRIFT 항목대로 아직 미집행(체크리스트에 `[ ]` 로 정확히 반영돼 있어 은폐되지 않음).
- WARNING(등록 표면 안전망 서술 과장) — plan 의 등록 표면 표가 "자동 검증은 2곳뿐" 이라고 정정되고 나머지는 "수동 대조" 로 명시돼, 실제 가드 커버리지(`.claude/test-stages.sh`+`packages-checks.yml` 2곳만 자동)와 일치. 정정 반영 확인.

## 요약

`@workflow/masked-markers` 공유 패키지 추출은 "동작 무변경 리팩터"라는 스스로의 목표를 실제로 달성했다 — 마커 3종 리터럴·`MASKED_MARKERS`·`isMaskedMarker`·깊이 상한(`MAX_MASK_DEPTH`)의 값과 판정 로직이 패키지로 이동했지만 backend/frontend 양쪽 소비처는 재export shim 을 통해 기존 import 경로·시그니처를 그대로 유지하며, 전수 대조·실측 테스트(패키지 17/17, backend 106/106, frontend 33/33, lint/build 전부 clean)로 회귀가 없음을 확인했다. 등록 표면 8곳(test-stages.sh, packages-checks.yml pathspec+matrix, 두 package.json, 세 Dockerfile, lockfile)도 전수 반영됐고, 별개 불변식인 WS `MAX_SANITIZE_DEPTH` 는 근거를 갖고 의도적으로 미병합 상태를 유지한다. 이전 라운드 consistency-check 가 잡은 Critical(frontmatter 필수 필드)과 WARNING(등록 표면 서술 과장, 트래커 미참조)은 모두 코드에 반영되어 해소됐다. 유일하게 남은 실질 이슈는 spec `14-external-interaction-api.md` R17 의 "backend SoT / 프런트 미러" 문장이 이관 후 stale 해졌다는 것인데, 이는 코드 결함이 아니라 spec 갱신 누락(SPEC-DRIFT)이며 developer 가 이미 정확히 인지하고 plan 체크리스트에 "planner 턴 필요" 로 명시적으로 걸어 둔 상태다 — 코드를 되돌릴 사안이 아니라 다음 planner 턴에서 spec 문장을 정정하면 되는 낮은 위험의 이월 항목이다. 그 외 발견된 사항(미러 가드의 도달 불가 분기)은 기능에 영향 없는 명확화 수준의 INFO 다.

## 위험도

LOW
