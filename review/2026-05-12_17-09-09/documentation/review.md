## 발견사항

### [WARNING] 섹션 번호 재정렬로 인한 문서 URL 변경
- **위치**: `frontend/src/lib/docs/registry.ts` diff
- **상세**: `03-expression-language` → `04-expression-language`, `04-run-and-debug` → `05-run-and-debug` 등으로 섹션 번호가 전반적으로 밀렸다. `registry.ts`의 `SECTION_LABELS`는 실제 디렉터리 이름에 매핑되므로, 실제 디렉터리가 함께 리네임되었다면 기존 `/docs/03-expression-language/...` URL이 모두 깨진다. spec 문서나 이메일, 외부에서 하드코딩된 딥링크가 있다면 404를 반환하게 된다. Next.js `redirects` 또는 `rewrites`로 이전 경로를 처리하는지 확인이 필요하다.
- **제안**: `next.config.js` 또는 `next.config.ts`에 이전 섹션 경로 → 새 경로 redirect 규칙을 추가하거나, 섹션 번호 재정렬이 실제 디렉터리 리네임 없이 label만 변경한 것인지 명확히 주석으로 기록한다.

---

### [WARNING] MDX "See also" 링크가 실제 앵커로 연결되지 않음
- **위치**: `workspaces-and-members.en.mdx` 및 `workspaces-and-members.mdx` — "See also" / "함께 읽기" 섹션
- **상세**: 세 개의 "See also" 링크가 모두 `(/docs/spec)` 같은 형식으로 작성되어 있다. 이 경로가 실제로 존재하지 않거나 spec 뷰어 페이지가 없다면 404가 발생한다. 특히 `[Spec: Auth](/docs/spec)`, `[Spec 인증/인가](/docs/spec)` 는 문서 시스템 내 어떤 파일도 직접 가리키지 않는다.
- **제안**: 실제 문서 경로(예: `/docs/05-run-and-debug/...` 또는 `/docs/08-workspace-and-team/...`)를 사용하거나, 연결 대상 문서가 아직 없다면 링크를 비활성화(텍스트만)하고 "추후 문서화 예정"을 표기한다.

---

### [INFO] 빈 상태(Empty State) 메시지가 `ownership` 필터를 미반영
- **위치**: `frontend/src/app/(main)/workflows/page.tsx` — `EmptyState` description 및 action 조건
- **상세**: `description`과 `action` 렌더링 조건이 `debouncedSearch || filter !== "all"`만 검사하고 `ownership !== "all"` 을 포함하지 않는다. ownership이 `mine` 또는 `shared`로 설정된 상태에서 결과가 없으면 "첫 번째 워크플로우를 만들어 보세요" 메시지와 "Create Workflow" 버튼이 나타나, 필터 때문에 빈 것임을 사용자에게 알리지 못한다. UX copy 관점의 누락이다.
- **제안**: 조건을 `debouncedSearch || filter !== "all" || ownership !== "all"`로 확장하고, i18n 메시지 `workflows.adjustFiltersHint`가 소유 필터에도 적용된다는 점을 주석 또는 번역 파일에 기록한다.

---

### [INFO] Plan 문서 내 "3차 ai-review" RESOLUTION 첨부 누락
- **위치**: `plan/in-progress/team-workspace-followups.md` § 4. REVIEW
- **상세**: "잔여 마무리(소유 필터·매뉴얼)에 대한 3차 ai-review는 본 plan 완료 직전 1회 추가 수행 후 RESOLUTION 첨부"라고 명시되어 있지만, 현재 REVIEW 항목이 `[x]`로 체크되면서 RESOLUTION 문서 첨부 여부는 기록되지 않았다. 본 리뷰가 3차 ai-review에 해당하므로 완료 후 `review/` 디렉터리에 RESOLUTION을 추가하고 plan 문서를 갱신해야 한다.
- **제안**: 본 리뷰 결과에 대한 `review/<timestamp>/RESOLUTION.md` 를 작성하고 plan 문서 §4의 해당 항목을 업데이트한 뒤, 모든 항목이 완료되면 `plan/complete/`로 이동(`git mv`)한다.

---

### [INFO] `findAll` 서비스 메서드에 JSDoc 부재
- **위치**: `backend/src/modules/workflows/workflows.service.ts:53`
- **상세**: `ownership` 파라미터가 추가되면서 메서드 시그니처가 바뀌었으나 `findAll`에 JSDoc이 없다. DTO의 JSDoc과 인라인 주석은 충분히 작성되어 있고, 다른 메서드들도 JSDoc 없이 일관성 있게 작성되어 있으므로 강제 사항은 아니나, `userId` 파라미터가 새로 추가된 이유(ownership 필터 적용)는 메서드 수준에서도 한 줄로 표현하면 가독성이 높아진다.
- **제안**: 필요 시 `/** ownership 필터 적용을 위해 userId 필수. 팀 워크스페이스 여부 판단은 내부에서 workspacesService.findById 호출. */` 수준의 단문 JSDoc 추가.

---

## 요약

전반적으로 문서화 수준이 높다. DTO의 JSDoc은 스펙 섹션 번호까지 명시하고, Swagger `@ApiOperation` 설명에는 팀/개인 워크스페이스 동작 차이가 명확히 기술되어 있으며, MDX 매뉴얼 두 버전(한·영)이 동시에 추가되었다. i18n 접근성 레이블(`aria`)도 빠짐없이 포함되었다. 다만 섹션 번호 재정렬에 따른 기존 URL 안정성, MDX "See also" 링크의 실제 해소 가능성, ownership 필터를 미고려한 빈 상태 UX 카피, plan의 3차 리뷰 RESOLUTION 첨부 처리 등 후속 조치가 필요한 항목이 있다.

## 위험도

**LOW**