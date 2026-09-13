# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 리네임(`guide-error-code-*` → `guide-identifier-*`) 후 자매 파일의 "sibling" 참조가 존재하지 않는 옛 이름을 계속 가리킨다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` (이번 diff 에는 포함되지 않은 파일이라 게이트 숫자가 없어 `Read` 로 직접 확인한 실제 줄 번호)
  - 상세: 해당 줄은 `"자매 \`guide-error-code-existence.test.ts\` 는 **코드 토큰**의 실재를 본다"` 라고 적고 있는데, 이 PR 이 그 파일을 `guide-identifier-existence.test.ts` 로 리네임(구 파일은 삭제)했다. `grep -rn "guide-error-code" codebase/ spec/ PROJECT.md` 로 확인한 결과 이 줄이 저장소에 남은 유일한 실질적 stale 참조다(`guide-identifier-scan.ts:9` 의 언급은 "`#1330` 이 …로 만들었다" 는 의도된 역사 서술이라 비대상). plan 체크리스트는 "리네임 … + `PROJECT.md` · 트래커 전방 참조 5곳" 을 갱신했다고 적지만 이 sibling 파일은 그 5곳에 포함되지 않았던 것으로 보인다 — diff 대상 목록에도 없다. 다음 사람이 이 문장을 따라가면 존재하지 않는 파일명을 찾게 된다.
  - 제안: `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 로 문구를 갱신한다(한 줄 수정, 이 PR 범위에 포함해도 비용이 낮다).

- **[WARNING]** `composeTexts` 수집 범위가 이름·JSDoc 의도보다 넓다 — "compose" 가 아니라 "루트의 모든 `.yml`/`.yaml`"을 읽는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:48-51`
    ```
    const composeTexts = fs
      .readdirSync(root)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => fs.readFileSync(path.join(root, f), "utf8"));
    ```
  - 상세: 변수명 `composeTexts` 와 `guide-identifier-scan.ts` 의 `collectEnvDeclarations` JSDoc("compose 가 컨테이너에 주입만 하는 값")은 "docker-compose 파일" 을 대상으로 서술하는데, 실제 필터는 파일명이 아니라 확장자만 본다. 실측(`ls *.yml *.yaml`)하니 저장소 루트에는 `docker-compose.yml`·`docker-compose.e2e.yml` 외에 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml` 도 걸려 매 테스트 실행마다 규모가 큰 락파일까지 정규식으로 훑는다. 오늘은 `grep -cE '^\s+[A-Z][A-Z0-9]*(_[A-Z0-9]+)+:\s' pnpm-lock.yaml` 이 0건이라 판정에 영향은 없지만(실측), 이 파일은 이 저장소가 반복적으로 겪어 온 "이름/문서가 약속하는 범위 ≠ 실제 구현 범위" 클래스(`feedback_documented_guarantee_wider_than_built`, `feedback_defense_defined_one_notch_narrow`)의 다른 방향(이번엔 **넓은** 쪽) 사례다. 훗날 루트에 다른 `.yml`(예: `renovate.yaml`, `codecov.yml`)이 추가되면 아무도 의도하지 않은 채로 기준집합에 스며든다.
  - 제안: 파일명에 `compose` 포함 여부(`f.includes("compose")`)로 필터를 좁히거나, 최소한 왜 확장자만으로 충분한지(예: "오늘 루트에 non-compose yaml 이 2개뿐이고 전수 확인했다") 를 이 파일의 다른 단언들처럼 주석으로 실측 근거를 남긴다.

- **[INFO]** 같은 설계 근거(3축 실측표·"허용목록 없음" 번복 서사)가 세 곳에 거의 그대로 삼중 복제돼 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-51` (헤더 주석) · `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:18-27` (JSDoc) · `plan/in-progress/guide-identifier-existence.md` §A~D 전체
  - 상세: 프로젝트가 "왜" 를 코드에 남기는 관례를 지키는 것은 일관되지만, 같은 표(`#1330` 축별 판정 ✗/✗/✗)와 같은 서사가 세 파일에 거의 축약 없이 반복된다. 이번 PR 자체가 그 비용을 보여준다 — 파일명 하나를 바꾸는 데 `PROJECT.md`·plan·트래커 항목 등 다수 지점을 손으로 동기화해야 했다(plan 체크리스트 "리네임 … 트래커 전방 참조 5곳"). 세 개의 동기화 지점은 다음 설계 변경(예: 축이 또 바뀌는 경우) 때 드리프트 위험을 늘린다.
  - 제안: 즉각 조치는 불요 — 다만 다음에 이 가족의 설계를 다시 바꿀 때는 "코드 헤더가 SoT, 테스트 JSDoc·plan 은 그것을 가리키기만" 하는 방향으로 점차 정리할 것을 권한다.

## 요약

핵심 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)은 순수 함수·낮은 순환 복잡도·단일 책임을 유지하고, 오히려 구 파일(`guide-error-code-scan.ts`) 대비 `codeTableRows`/`TABLE_HEADER_WITH_CODE`/`CODE_CONTEXT` 같은 문맥 게이팅 로직을 통째로 걷어내 더 단순해졌다. vacuity-floor·축별 대조군·과거 결함 재현 테스트 구성도 이 코드베이스의 확립된 패턴을 잘 따른다. 다만 리네임이 한 파일(`guide-sanitized-message-parity.test.ts`)의 sibling 참조까지는 닿지 못해 존재하지 않는 파일명을 가리키는 stale 텍스트가 남았고, `composeTexts` 수집 범위가 이름·문서가 약속하는 것보다 넓어(루트의 모든 yaml, 락파일 포함) 향후 조용한 스코프 오염 위험이 있다. 둘 다 동작을 깨지는 않는 낮은 비용의 수정 대상이며, 그 외 설계 근거의 삼중 복제는 이 프로젝트 관례상 허용 범위이나 다음 변경 시 동기화 비용을 고려할 만하다.

## 위험도

LOW
