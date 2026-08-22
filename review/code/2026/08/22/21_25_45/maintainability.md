# 유지보수성(Maintainability) 리뷰 결과

### 발견사항

- **[INFO]** "reasons 전체 추출" try/catch 보일러플레이트가 파일 내 2곳에 동일한 형태로 반복된다 (중복 코드)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:341-351` (신규 추가) — 동일 형태가 이미 같은 파일 `:295-308` (`[캐너리] raw 에서 걸리면 coerce_failed 가 섞이지 않는다`)에 존재
  - 상세: 두 블록 모두 `let reasons: string[] = []; try { resolveTriggerParametersRejectingMasked(...); } catch (err_: unknown) { if (err_ instanceof TriggerParameterValidationException) { reasons = err_.errors.map((e) => e.reason); } }` 형태로, 호출 인자만 다르고 나머지 12~13줄이 사실상 동일하다. 파일 상단에는 이미 `rejectedFields`(필드만 추출, 28-44행) 헬퍼로 "resolve 시도 → 예외 캐치 → 값 추출" 반복을 줄이는 확립된 관행이 있는데, 이번에 필요해진 "reason 전체(필터 없이) 추출" 용도는 그 관행을 따르지 않고 두 번째 인라인 사본을 만들었다. 다만 인스턴스가 2개뿐이라 즉시 조치가 필요한 수준은 아니다(rule-of-three 미달) — 3번째 유사 요구가 생기면 추출을 재고할 가치가 있다.
  - 제안: `rejectedFields` 옆에 `allReasons(schema, raw): string[]`(필터 없이 `reason` 전부 반환) 같은 헬퍼를 추가해 두 테스트가 공유하게 하면, 다음에 유사한 "reason 배열 전체" 검증이 필요할 때 세 번째 복붙을 막을 수 있다. 지금 당장 블로킹할 사안은 아님.

- **[INFO]** 신규 테스트 JSDoc(14줄, `:313-326`)이 길지만 파일의 기존 컨벤션과 정확히 일치한다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:313-326`
  - 상세: 이 블록은 트레이드오프의 방향·왜 고정할 가치가 있는지·되돌리려면 무엇을 의도적으로 갱신해야 하는지를 담아 길다. 같은 파일의 다른 캐너리/경계/통합 테스트들(예: `:58-64`, `:151-153`, `:168-173`, `:215-219`, `:229-238`, `:264-269`, `:287-292`)도 동일하게 "결정을 근거와 함께 코드 옆에 고정하고, 무엇을 갱신해야 되돌릴 수 있는지 명시"하는 장문 JSDoc 스타일을 확립해 두고 있다. 파일 고유 컨벤션을 그대로 따른 것이라 일관성 문제는 없다.

- **[INFO]** 신규 테스트가 대조군(control group)을 실험군보다 먼저 명시적으로 단언한다 — 가독성·의도 명확성 측면에서 좋은 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:334-338`
  - 상세: `count: 1`(정상 값)로 마커가 여전히 잡히는지 먼저 확인한 뒤 `count: 'not-a-number'`(실험군)로 넘어가는 구조라, 이 fixture 가 "애초에 마커를 못 잡는 값"이 아님을 코드 자체가 보여준다. 인라인 주석도 그 이유를 명시해 별도 설명 없이도 테스트 의도가 드러난다. 조치 불요, 참고 기록.

- **[INFO]** `err_` 트레일링 언더스코어 네이밍, 예외 타입 체크 후 `throw`/무시 분기 등 catch 블록 컨벤션이 파일 전체(헬퍼 `rejectedFields` 포함, 3곳)에서 일관적으로 유지된다. 신규 코드가 이 컨벤션을 정확히 재사용했다. 조치 불요.

- **[INFO]** `plan/in-progress/masked-marker-test-gaps.md` · `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 프로세스 문서로, 기존 트래커 컨벤션(체크박스 + 커밋 해시 인용 + blockquote 근거)을 그대로 따르고 있어 문서 구조 관점에서 유지보수성 문제는 없다. `review/code/2026/08/22/21_15_53/**` · `review/consistency/2026/08/22/20_57_25/**` 는 orchestrator/이전 리뷰 라운드가 생성한 감사 산출물로, 저자가 직접 작성한 코드/문서가 아니라 본 관점(가독성·네이밍·함수 길이 등)의 리뷰 대상이 아니다.

### 요약

이번 diff 의 실질 코드 변경은 `reject-masked-resubmission.spec.ts` 에 캐너리 테스트 1건(약 42줄, JSDoc 포함)을 추가한 것이 전부다. 신규 테스트는 파일이 이미 확립한 네이밍 태그(`[캐너리]`/`[경계]`/`[통합]`/`[회귀]`), 헬퍼 재사용 관행, "결정을 근거와 함께 코드 옆에 고정"하는 JSDoc 스타일, `err_ instanceof` catch 패턴을 모두 일관되게 따르고 있어 가독성·네이밍·일관성 면에서 문제가 없다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 테스트 코드로서 정상 범위다. 유일하게 지적할 점은 "reason 배열 전체 추출" try/catch 블록이 기존 테스트(`:295-308`)와 거의 동일한 형태로 한 번 더 반복된다는 것인데, 인스턴스가 2개뿐이라 지금 추출을 강제할 수준은 아니며(INFO), 다음에 유사 요구가 또 생길 때 헬퍼화를 재고하면 된다. 나머지 변경(plan 문서 2건, 이전 리뷰 라운드의 감사 산출물)은 프로세스/기록성 문서라 본 관점의 실질 리스크가 없다.

### 위험도
NONE
