# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `dependabot.yml` — 제거된 `eslint-plugin-unicorn` ignore 항목 자리에 남은 22줄짜리 "묘비(tombstone)" 주석이 이제 어떤 YAML 노드에도 붙어 있지 않다.
  - 위치: `.github/dependabot.yml:75-96`
  - 상세: `- dependency-name: "eslint-plugin-unicorn"` 항목 자체는 삭제됐고, 그 이유를 설명하던 주석 블록만 `ignore:` 리스트 끝에 고아 상태로 남았다. YAML 문법상 문제는 없고 "왜 지웠는지 + 되살릴 조건"을 기록한 의도는 합리적이지만, 대응하는 살아있는 설정이 없는 채로 다음 항목이 추가되기 전까지 계속 방치될 경우 `#1049` 류 사고(주석-값 드리프트)의 씨앗이 될 수 있다.
  - 제안: 이번 결정이 워낙 상세히 기록돼 있으므로 현재로선 문제 삼을 정도는 아니나, 다음에 이 파일을 만질 때 이 블록이 여전히 유효한지(가드·`--strict-peer-dependencies` 상태) 재확인하고 필요시 축약할 것.

- **[INFO]** `eslint-disable-next-line` 스타일이 파일 간 불일치.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94`
  - 상세: 이 저장소는 `code.handler.ts:44` 등에서 `// eslint-disable-next-line no-console -- <사유>` 처럼 규칙명 뒤에 `--` 인라인 사유를 붙이는 관례가 있다. 이번에 추가된 `// eslint-disable-next-line preserve-caught-error`(바로 위 여러 줄의 사유 주석은 있지만 인라인 `--` 없음)는 그 컨벤션과 다르다.
  - 제안: 일관성을 위해 `-- <한 줄 요약>` 을 덧붙이거나, 두 스타일 중 하나로 저장소 컨벤션을 명문화.

## 검증한 항목 (문제 없음)

- `let x: T = <default>;` → `let x: T;` 형태의 dead-initializer 제거(`no-useless-assignment`, eslint 10 recommended)가 8개 파일(`ssrf-safe-url.util.ts`, `form-mode.ts`, `execution-engine.service.ts`, `public-webhook-throttle.guard.ts`, `kb-tool-provider.ts`, `information-extractor.handler.ts`, `web-chat-sdk/src/index.ts`)에 걸쳐 기계적으로 동일 패턴으로 적용됨 — 각 지점에서 모든 실행 경로가 사용 전 재할당됨을 직접 추적해 확인(예: `kb-tool-provider.ts` catch 블록은 항상 `return`, `knowledge-base.service.ts` catch 블록은 항상 `throw`). 일관된 스타일로 반영돼 있고 동작 변화 없음.
- `information-extractor.handler.ts` — 루프 스코프의 `let followUp = ''`를 제거하고 사용 지점에서 `const followUp = result.content ?? ''`로 지역화. 실제로 그 변수는 바로 다음 `return`에서만 쓰이므로 스코프 축소가 가독성을 개선함(불필요하게 넓은 스코프의 mutable 변수 제거).
- `ai-turn-executor.ts` — `finalSystemPrompt` 재할당 두 곳을 삭제하고 대신 "왜 더 이상 갱신하지 않는지"를 설명하는 주석을 남김. `grep` 으로 해당 함수 스코프 내 이후 참조가 없음을 확인 — 안전한 정리이며, 의도를 남긴 것도 좋은 관행.
- `text-chunker.ts` — 강제 분할 분기에서 `overlapBuffer = getOverlapText(...)` 계산 후 두 줄 뒤 `overlapBuffer = ''`로 즉시 덮어써지던 dead store를 제거하고 사유 주석으로 대체. 불필요한 계산과 혼란을 동시에 없앤 개선.
- `expression-resolver.service.ts` / `code.handler.ts` — 에러 재throw 시 `{ cause: err }` 첨부, 디버깅 가능성 향상. 나머지 한 곳(`secret-resolver.service.ts`)만 의도적으로 `cause` 를 생략(원본 crypto 에러 상세를 클라이언트에 노출하지 않기 위함)하고 그 사유를 상세히 남김 — 일관성 예외가 근거와 함께 문서화됨.
- `eslint-unicorn-peer-guard.ts` `parseGteFloor` — 정규식을 `>=X.Y.Z` 전용에서 `>=X`/`>=X.Y`/`>=X.Y.Z` 까지 확장. JSDoc이 "왜 3-component만으로 부족했는지"를 실측과 함께 설명하고, 대응 테스트(`eslint-unicorn-peer.spec.ts`)에 회귀 케이스(`>=10.4`, `>=9.18`, `>=9`, `>=10`)와 무효 케이스(`>=`, `>=x`)를 모두 추가 — 형태(자릿수) 축을 커버리지에 반영한 좋은 예.
- 9개 `package.json`(backend 제외, packages/* 전부)에 걸친 거의 동일한 eslint 버전 diff는 모노레포 워크스페이스 특성상 불가피한 반복이며 DRY 위반으로 볼 성격이 아님.
- `readInstalledPackageJson` 헬퍼(`eslint-unicorn-peer.spec.ts`) — `require('pkg/package.json')`이 `exports` 맵 제약으로 막힌 이유와 파일 경로 직접 읽기로 전환한 근거가 JSDoc에 명확히 기술됨. 이름·역할이 명확하고 재사용 가능한 형태.

## 요약

이번 변경은 ESLint 9→10 상향(backend + packages 9개)과 그로 인해 새로 활성화된 `no-useless-assignment`/`preserve-caught-error` 규칙 위반 15건의 기계적 수정, 그리고 관련 문서(`dependabot.yml`, `eslint.config.mjs` 헤더, plan 파일)의 근거 갱신으로 구성된다. 각 코드 변경은 범위가 매우 좁고(대부분 한 줄 또는 인접 몇 줄), 왜 그 변경이 안전한지를 직접 코드 흐름을 추적해 확인했으며 문제되는 지점을 찾지 못했다 — dead-initializer 제거·dead-store 제거·cause 체이닝 추가 모두 실질적인 가독성/디버깅성 개선이다. 발견된 두 건은 모두 INFO 수준의 스타일·일관성 관찰(제거된 항목의 긴 tombstone 주석, disable 주석의 인라인 사유 표기 불일치)로, 병합을 막을 이유는 없다. 코드베이스 전반의 "왜"를 남기는 주석 관행이 이번 PR에도 일관되게 유지되고 있다.

## 위험도

LOW
