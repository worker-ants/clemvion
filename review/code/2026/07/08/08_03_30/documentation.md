# 문서화(Documentation) 리뷰 결과

리뷰 대상: `codebase/frontend/src/content/docs/06-integrations-and-config/{agent-memory,discord,knowledge-base,makeshop,mcp-servers,telegram,web-chat-sdk}.mdx` 의 `order` frontmatter 재정렬 7건 + `spec/2-navigation/_product-overview.md` NAV-UG-02 텍스트 갱신 1건 (커밋 `1d4c57263 fix(docs): 유저 가이드 IA 정합`).

## 발견사항

- **[INFO]** `order` 재정규화가 SoT(`spec/2-navigation/13-user-guide.md` §IA 트리)와 정확히 일치함 — 검증 완료
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/*.mdx` frontmatter `order`
  - 상세: 재부여 후 섹션 내 12개 canonical 파일의 `order` 값(1~12: integration-management→models→knowledge-base→mcp-servers→cafe24→discord→slack→telegram→web-chat→web-chat-sdk→makeshop→agent-memory)이 `spec/2-navigation/13-user-guide.md` L69-81 IA 트리 순서와 완전히 일치함을 실제 파일을 대조해 직접 확인함. 커밋 메시지가 주장한 "수정 전 cafe24·mcp-servers order:5 중복 + order:3 결번"도 diff상 개별 변경분(`mcp-servers.mdx` 5→4, `knowledge-base.mdx` 4→3)과 부합해 근거가 타당함. 문서화 관점에서 결함 없음 — 참고용 기록.
  - 제안: 없음 (통과).

- **[WARNING]** `order` 중복/결번 같은 회귀를 잡아주는 자동 가드 테스트 부재
  - 위치: `codebase/frontend/src/lib/docs/registry.ts` (`loadDocsIndex`) / `codebase/frontend/src/lib/docs/__tests__/registry.test.ts`
  - 상세: 이번 fix가 고친 버그(같은 섹션 내 `order` 중복 2건 + 결번 1건)는 런타임에서 에러 없이 조용히 사이드바 표시 순서만 어긋나는 종류라 코드 리뷰/consistency-check 수작업으로만 발견됐다. `registry.test.ts:24`의 기존 테스트는 정렬 동작 자체만 소규모 fixture로 검증하며, 실제 콘텐츠 디렉터리를 스캔해 섹션별 `order` 유일성/연속성을 단언하는 가드는 없다. `assertFrontmatter`(registry.ts:98)도 `order`가 숫자인지만 검사하고 중복은 허용한다.
  - 제안: `registry.test.ts`에 `loadDocsIndex(DEFAULT_DOCS_ROOT)` 결과를 대상으로 섹션별 `order` 값의 유일성(및 가능하면 1..N 연속성)을 단언하는 테스트를 추가해, 향후 신규 페이지 추가·재편 시 동일한 드리프트가 재발하지 않도록 하는 것을 권장.

- **[INFO]** (사전 존재, 이번 diff 범위 밖) `.en.mdx` sibling 4건이 `_i18n-conventions.md` 규약을 위반해 여전히 frontmatter를 보유, 그 안의 `order`가 이번 fix로 canonical 값과 추가로 벌어짐
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,telegram,makeshop,agent-memory}.en.mdx`
  - 상세: `codebase/frontend/src/content/docs/_i18n-conventions.md` L14-15는 "canonical 파일이 페이지의 단일 소스이며 프론트매터는 여기에만 적는다. 영어 번역 sibling은 프론트매터 없이 본문만 작성한다"고 명시한다. 그러나 위 4개 `.en.mdx`는 `title`/`section`/`order`/`summary` 전체 frontmatter를 그대로 갖고 있다 (반면 같은 섹션의 `web-chat-sdk.en.mdx`/`knowledge-base.en.mdx`/`mcp-servers.en.mdx`는 규약대로 frontmatter가 없음 — 섹션 내 일관성도 이미 깨져 있었음). `registry.ts`의 `listMdxFiles`가 locale sibling을 내비게이션 스캔에서 제외하고, `buildSearchIndex`도 sibling의 `parsed.content`(본문)만 쓰고 `parsed.data`(frontmatter)는 무시하므로 이 필드들은 런타임에 영향이 없는 dead metadata로 보인다. 다만 이번 fix로 `discord.mdx`(order 6) vs `discord.en.mdx`(order 8, 즉 discord.mdx의 예전 값) 처럼 canonical과 sibling의 `order`가 서로 반대로 뒤바뀐 상태가 됐고, `title`/`summary`도 동기화 안 됨 — 향후 콘텐츠 편집자가 sibling의 frontmatter를 실제로 쓰이는 값으로 착각해 잘못 수정할 위험이 있다.
  - 제안: 이번 diff의 직접 원인은 아니므로 별도 클린업 태스크로, 4개 `.en.mdx`에서 규약대로 frontmatter 블록을 제거해 섹션 내 나머지 3개 sibling과 일관되게 맞추는 것을 권장 (선택: `registry.test.ts` 또는 빌드 가드에 "`.en.mdx`는 frontmatter delimiter(`---`)를 갖지 않아야 한다" 단언을 추가해 재발 방지).

- **[INFO]** `spec/2-navigation/_product-overview.md` NAV-UG-02 텍스트 갱신 정확성 검증
  - 위치: `spec/2-navigation/_product-overview.md` §3.11 (NAV-UG-02 행)
  - 상세: "시작하기 · 노드 · 워크플로우 에디터 · 표현식 · 실행/디버깅 · 통합/설정 · 워크스페이스와 팀 · FAQ" 8개 섹션 열거가 `codebase/frontend/src/lib/docs/registry.ts`의 `SECTION_LABELS`(01-getting-started ~ 99-faq, 8개) 및 `spec/2-navigation/13-user-guide.md`의 디렉터리 트리와 순서·개수 모두 일치함을 확인. 라벨은 기존 스타일대로 축약형(`노드 가이드`→`노드`, `실행과 디버깅`→`실행/디버깅` 등)을 유지해 이전 버전과 표기 관례가 일관됨.
  - 제안: 없음 (통과).

- **[INFO]** CHANGELOG 갱신 불요 판단 근거
  - 위치: `CHANGELOG.md`
  - 상세: 이 저장소의 `CHANGELOG.md`는 기능적 동작 변경(스펙 상태 flip 동반)만 기록하는 관례이며, 이번 변경은 사이드바 표시 순서 메타데이터 정정 + spec 텍스트 오탈 보정으로 사용자 행동에 영향이 없는 순수 IA 정합화다. 커밋 메시지 자체가 "이전 PR(#855)의 consistency-check가 지적한 선행 드리프트 2건 정정"이라는 배경·근거·검증 방법(가드 스위트/lint/build)을 상세히 남겨 추적성이 이미 확보돼 있음.
  - 제안: 없음.

## 요약

순수 문서 메타데이터(`order` frontmatter) 재정렬과 spec 요구사항 텍스트(NAV-UG-02) 보정으로 구성된 diff이며, 두 변경 모두 SoT(`spec/2-navigation/13-user-guide.md`)와 대조해 정확함을 확인했다. 커밋 메시지가 변경 배경·근거·검증 절차를 충실히 남겨 추적성이 좋다. 다만 (1) 이런 종류의 order 중복/결번 드리프트를 자동으로 잡아줄 회귀 테스트가 없어 향후 재발 가능성이 있고, (2) 인접한 사전 존재 이슈로 일부 `.en.mdx` sibling 파일이 i18n 규약을 위반해 죽은(dead) frontmatter를 남긴 채 이번 fix로 canonical 값과 더 어긋나 향후 편집 실수를 유발할 소지가 있다 — 둘 다 이번 diff를 막을 사유는 아니며 후속 개선 항목으로 권고한다.

## 위험도

LOW
