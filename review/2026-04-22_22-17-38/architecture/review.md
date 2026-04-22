### 발견사항

---

**[WARNING] 모듈 스코프 뮤터블 싱글턴 캐시**
- 위치: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE: string | null = null;`
- 상세: 이 변수는 NestJS 모듈 경계 바깥의 파일 스코프에서 살아있다. 테스트 실행 시 Jest의 모듈 캐시 정책에 따라 같은 프로세스 내 여러 `describe` 블록이 이 캐시를 공유한다. `getAllFunctionNames()`가 테스트 환경에서 다른 값을 반환하도록 mock되면, 첫 번째 호출 결과가 영구히 굳어 후속 테스트에 오염된다. NestJS의 `onModuleDestroy` 또는 `--resetModules` 없이는 해소되지 않는다.
- 제안: 캐시를 `Map<string, string>` 형태로 함수 인자 기반 메모이즈(함수명 목록을 key)하거나, `getExpressionReferenceSection()`을 `@Injectable()` 서비스로 이동해 DI 컨테이너가 수명을 관리하게 한다. 테스트 격리가 최우선이면 `jest.resetModules()` 또는 `jest.isolateModules()`를 사용한다.

---

**[WARNING] 정적 블록 상수가 레이아웃 상수를 빌드 타임에 캡처**
- 위치: `system-prompt.ts` — `const STATIC_BLOCK_3_EDIT_PLAYBOOK = \`...\${LAYOUT_FALLBACK_WIDTH}...\``
- 상세: `STATIC_BLOCK_3_EDIT_PLAYBOOK`은 모듈 로드 시점에 `LAYOUT_FALLBACK_WIDTH` 등의 값을 문자열로 굳힌다. 현재는 이 상수들이 동일 파일에서 `const`로 선언되어 있으므로 사실상 무해하지만, 만약 레이아웃 상수가 외부 설정(환경 변수, DB)에서 읽어야 하는 요구가 생기면 `STATIC_BLOCK_3` 상수를 함수로 바꾸거나 `buildSystemPrompt` 내부로 이동해야 하는 변경이 강제된다. 아키텍처적으로 "설정가능성"과 "정적 캐시 효과"가 충돌하는 지점이다.
- 제안: 레이아웃 상수를 변경할 가능성이 없다면 현 구조 유지. 만약 런타임 설정 가능성이 필요하면 `renderEditPlaybook(layoutConfig: LayoutConfig): string` 형태의 팩토리 함수로 추출.

---

**[INFO] `buildSystemPrompt`에 블록 추가 시 함수 본체를 직접 수정해야 함 (개방-폐쇄 원칙 약한 위반)**
- 위치: `system-prompt.ts` — `buildSystemPrompt` 함수의 `return` 템플릿 리터럴
- 상세: 새 정적 블록을 추가하려면 `buildSystemPrompt` 내 템플릿 리터럴을 직접 수정해야 한다. 5-블록 구조가 메모리 문서와 테스트로 계약화되어 있어 실수할 경우 테스트가 잡아주지만, 블록 수가 늘어날수록 함수 본체가 다시 산만해진다.
- 제안: 지금 규모(5블록)에서는 허용 범위. 블록이 7개 이상으로 늘어나면 `const blocks: string[] = [STATIC_BLOCK_1, STATIC_BLOCK_2, ...]` 배열 + `join('\n')` 패턴이 가독성과 순서 보장 양쪽에서 유리하다.

---

**[INFO] `renderActivePlanSection`의 복잡도 — 분기가 많은 단일 함수**
- 위치: `system-prompt.ts` — `function renderActivePlanSection`
- 상세: `null` / `completed` / `active` 세 케이스를 한 함수에서 처리하며 50줄 이상의 `lines.push` 체인이 이어진다. 현재 기능 범위에서는 큰 문제가 없지만, 향후 `status` 타입이 확장되면(예: `paused`, `error`) 이 함수 내에 분기가 누적된다.
- 제안: 각 status에 대한 render 함수(`renderActivePlan`, `renderCompletedPlan`)를 별도 함수로 분리하면 각 분기를 독립적으로 테스트할 수 있다. 지금은 INFO 수준.

---

**[INFO] 테스트가 `indexOf` 순서 검사로 프롬프트 구조적 계약을 고정**
- 위치: `system-prompt.spec.ts` — `5-block structural layout` describe 블록
- 상세: `prompt.indexOf(A) < prompt.indexOf(B)` 패턴은 LLM 프롬프트의 prefix-cache 친화적 순서를 코드 레벨에서 강제하는 영리한 접근이다. 단, 섹션 헤더 문자열이 바뀌면 테스트가 오탐(`-1 < -1` → `false`가 아닌 `(-1 < actual)` → `true`처럼 보이는 경우)할 수 있다. 두 `expect(idx).toBeGreaterThanOrEqual(0)` 가드가 이를 막아준다 — 올바른 방어.
- 제안: 유지. 다만 헤더 문자열을 상수(`SECTION_HEADER_EXPR_LANG = '## Expression language'`)로 추출하면 테스트와 구현 간 string drift를 방지할 수 있다.

---

**[INFO] `EXPRESSION_REFERENCE_CACHE` 명명 관례 불일치**
- 위치: `system-prompt.ts` — `let EXPRESSION_REFERENCE_CACHE`
- 상세: TypeScript 관례에서 `SCREAMING_SNAKE_CASE`는 컴파일 타임 상수(`const`)에 사용한다. `let` 변수에 이 관례를 사용하면 독자가 "재할당 불가"라 오해한다.
- 제안: `let expressionReferenceCache: string | null = null;`으로 camelCase 사용.

---

### 요약

이번 리팩토링의 핵심 아키텍처 결정 — 정적 블록을 모듈 스코프 상수로 올리고 동적 상태를 프롬프트 꼬리에 배치해 prefix-cache hit rate를 높이는 전략 — 은 구조적으로 타당하고 테스트로 계약화된 점도 긍정적이다. 주요 리스크는 `EXPRESSION_REFERENCE_CACHE`가 테스트 격리 없이 모듈 스코프에서 공유된다는 점이다. 지금은 `getAllFunctionNames()`가 테스트에서 mock되지 않으므로 문제가 드러나지 않지만, 이 전제가 깨지면 조용한 오염이 발생한다. 나머지 발견사항은 현 규모에서 허용 가능한 INFO 수준이다.

### 위험도

**LOW**