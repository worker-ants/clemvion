### 발견사항

- **[INFO]** 순수 메타데이터(frontmatter) 정규화 커밋 — 기능 완전성/엣지케이스/에러 시나리오 등 대부분의 점검 관점은 해당 없음
  - 위치: 7개 `.mdx` 파일의 `order:` 필드, `spec/2-navigation/_product-overview.md` NAV-UG-02 행
  - 상세: 리뷰 대상 커밋(`1d4c57263`)은 코드 로직 변경이 아니라 (a) `06-integrations-and-config` 섹션 12개 문서의 `order` frontmatter 재부여와 (b) 그에 대응하는 spec 요구사항 행(NAV-UG-02) 텍스트 업데이트뿐이다. `git show 1d4c57263`로 diff 범위를 직접 확인해 8개 파일·8줄 변경임을 검증했다.
  - 제안: 없음 (정보성)

- **[없음] 재부여된 order 값이 spec IA 트리(§2)와 라인 단위로 정확히 일치 — spec fidelity 검증 통과**
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/*.mdx` (`order` 필드) ↔ `spec/2-navigation/13-user-guide.md:69-81` (섹션 IA 트리)
  - 상세: 커밋 전 상태를 `git show 1d4c57263~1:.../<file>.mdx`로 역추적한 결과, 커밋 메시지가 주장하는 결함(cafe24·mcp-servers 모두 `order:5` 중복, `order:3` 결번, telegram/slack/discord/web-chat-sdk 역전)이 실제로 존재했음을 확인했다. 커밋 후 값은 `integration-management=1, models=2, knowledge-base=3, mcp-servers=4, cafe24=5, discord=6, slack=7, telegram=8, web-chat=9, web-chat-sdk=10, makeshop=11, agent-memory=12`로 1~12 결번·중복 없이 완결되며, 이는 `spec/2-navigation/13-user-guide.md` §2 IA 트리에 나열된 순서(69~81행)와 정확히 1:1로 일치한다. `NAV-UG-02` 신규 문구("시작하기 · 노드 · 워크플로우 에디터 · 표현식 · 실행/디버깅 · 통합/설정 · 워크스페이스와 팀 · FAQ")도 실제 `registry.ts`의 `SECTION_LABELS`(01~07, 99-faq 8개 키) 및 디렉터리 구조(`03-workflow-editor`, `07-workspace-and-team` 실존 확인)와 정확히 일치한다.
  - 참고: `loadDocsIndex`(order 값 dedupe/검증 없이 stable sort만 수행)가 과거 중복값을 조용히 허용했기 때문에 빌드 실패 없이 잠재해 있던 IA 드리프트였고, 이번 커밋으로 실제 해소됨을 확인.

- **[WARNING]** 재부여 대상 6개 KO 문서 중 4개의 legacy `.en.mdx` sibling frontmatter `order` 값이 갱신되지 않아 KO/EN 간 self-contradictory 메타데이터가 새로 발생
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx:5`(`order: 8`, KO는 `6`), `telegram.en.mdx:5`(`order: 6`, KO는 `8`), `makeshop.en.mdx:5`(`order: 10`, KO는 `11`), `agent-memory.en.mdx:5`(`order: 11`, KO는 `12`)
  - 상세: `codebase/frontend/src/lib/docs/registry.ts`의 `listMdxFiles()`가 `isLocaleSibling()`으로 `*.en.mdx`를 내비게이션 스캔에서 제외하고, `app/(main)/docs/[...slug]/page.tsx`도 `.en.mdx`에서는 MDX 본문(`MDXContent`)만 import하고 frontmatter는 항상 canonical KO 파일의 `doc.frontmatter`를 사용한다(라인 105-115). 따라서 이 4개 파일의 `order`(및 title/section/summary) 필드는 애플리케이션에서 전혀 읽히지 않는 **완전한 dead metadata**이며, 사이드바 정렬 등 런타임 동작에는 영향이 없다 — 커밋 메시지가 검증한 "빌드/테스트 통과"와 모순되지 않는다. 다만 이번 커밋이 KO 쪽 `order`만 갱신하고 같은 값을 들고 있던 EN sibling은 그대로 둬, 저장소에 서로 모순되는 숫자가 나란히 남게 됐다(예: discord 문서가 KO frontmatter엔 `order:6`, EN frontmatter엔 `order:8`). cafe24/slack(둘 다 en frontmatter 보유, 이번 커밋 미대상)은 KO/EN이 여전히 일치하고, knowledge-base/mcp-servers/web-chat-sdk의 `.en.mdx`는애초에 frontmatter 블록 자체가 없어(본문만 존재) 문제가 없다. 즉 "frontmatter를 아예 안 두거나(신규 패턴) 두면 두 로케일이 일치해야(구 패턴)" 하는 두 관행이 혼재된 상태에서, 이번 fix가 구 패턴 파일 중 절반만 건드려 불일치를 만들었다.
  - 제안: 기능상 영향 없는 저위험 이슈이지만, 향후 혼동 방지를 위해 (a) 4개 `.en.mdx`의 `order` 값을 KO와 동일하게 맞추거나, (b) 이미 정리된 6개 파일과 동일하게 legacy frontmatter 블록 자체를 제거해 "frontmatter는 canonical KO에만 존재" 패턴으로 통일하는 후속 정리 권장.

### 요약
리뷰 대상은 `06-integrations-and-config` 섹션 12개 문서 중 7개의 `order` frontmatter 재부여와 `spec/2-navigation/_product-overview.md`의 NAV-UG-02 요구사항 행 텍스트 보정으로 구성된, 순수 메타데이터 정합성 fix 커밋이다(`git show`로 실제 diff 8파일·8줄 확인). 커밋 전 상태를 역추적해 커밋 메시지가 주장한 결함(order 중복·결번·역전)이 실재했음을 검증했고, 커밋 후 값이 `spec/2-navigation/13-user-guide.md` §2 IA 트리 및 `registry.ts`의 `SECTION_LABELS`와 라인 단위로 정확히 일치함을 확인해 spec fidelity 관점에서 CRITICAL 사항은 없다. 다만 이번에 KO order를 바꾼 파일 중 discord/telegram/makeshop/agent-memory 4개는 대응하는 `.en.mdx`가 아직 legacy frontmatter를 갖고 있는데 그 `order` 값이 갱신되지 않아, 코드상 실제로 읽히지 않는(dead) 값이긴 하지만 저장소 안에 KO/EN 간 서로 다른 숫자가 남는 새로운 불일치가 생겼다 — 기능적 영향은 없는 저위험 후속 정리 항목으로 WARNING 처리했다.

### 위험도
LOW
