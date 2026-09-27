# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 케이스 문자(`e2e C · E`) 인용 드리프트가 서비스 주석에서만 고쳐지고, 같은 형태의 인용이 단위 테스트 주석엔 남아 있다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:116`
  - 상세: 직전 라운드(`review/code/2026/09/27/11_53_51`) INFO 7 은 "서비스 코드 주석이 `folder-crud.e2e-spec.ts` 의 테스트 케이스 라벨(e2e C·E)을 인용해, 두 파일이 독립적으로 드리프트하면 stale 해진다" 는 지적이었고, `692f1e8fd` 가 `folders.service.ts:73-74` 의 주석을 파일명만 남기도록 고쳤다(RESOLUTION.md INFO 7). 그런데 같은 패턴(`// 폴더 e2e C · E 가 sortOrder(키 부재) · parentId(거짓 null)로 드러냈다.`)이 `folders.service.spec.ts:116` 에는 그대로 남아 있다 — 이 줄은 `ad844a779` 에서 들어왔고 `692f1e8fd` 의 diff 범위 밖이라 이번 헬퍼 추출 커밋이 건드리지 않았다. `folder-crud.e2e-spec.ts` 의 `it('C. ...')`/`it('E. ...')` 가 재배치되면 이 단위 테스트 주석의 인용도 서비스 주석과 똑같이 stale 해질 수 있다. INFO 7 의 처방이 절반만 적용된 상태다.
  - 제안: 여기도 케이스 문자 대신 파일명만 인용하도록 한 줄 정리(`folder-crud.e2e-spec.ts` 참고 정도). 사소하고 병합을 막을 사유는 아니다.

- **[INFO]** 신규 유닛 테스트 2개의 이름이 같은 `describe` 블록 내 기존 관례(영문)와 계속 다르다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:117`, `:137`
  - 상세: `describe('update — parentId 재검증 (V-04)', ...)` 블록의 다른 10개 `it()` 는 전부 영문 서술(`renames without parent change`, `rejects self as parent` 등)인데 이번에 추가된 두 테스트(`'보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다'`, `'빈 본문이면 로드한 값을 그대로 저장한다'`)만 한국어다. 직전 라운드 INFO 6 으로 이미 지적됐고 plan(`plan/in-progress/folders-contract-e2e.md` "`/ai-review` 1R" 절)에서 "형제 유틸 스펙 `with-timeout.spec.ts` 처럼 저장소의 신규 테스트가 한국어 서술을 쓴다" 는 근거로 조치 불요 처분됐다 — 새 지적은 아니고 기존 처분을 재확인하는 수준이다.
  - 제안: 처분대로 조치 불요. 다만 이 파일 안에서는 영문 10 : 한국어 2 로 지역 일관성이 갈리는 상태가 그대로 남으므로, 팀이 한국어 `it()` 로 전환 중이라면 그 결정을 규약 문서(`spec/conventions/`)에 명시해 다음 사람이 어느 쪽이 맞는지 매번 재판단하지 않게 하는 편이 낫다.

## 긍정적으로 확인한 점

- 직전 라운드 WARNING 1(`Object.assign(folder, omitUndefined(data))` 관용구가 트리거 · 폴더 두 파일에 코드+장문 rationale 통째 복제)이 이번 커밋(`692f1e8fd`)으로 실제로 해소됐다. `src/common/utils/omit-undefined.ts` 로 로직·JSDoc rationale 을 한 곳에 모았고, `folders.service.ts:75` · `triggers.service.ts:622` 는 각각 헬퍼 호출 한 줄 + 자리 고유 사실 주석만 남아 중복이 줄었다. 헬퍼 자체(`omit-undefined.ts`)는 5줄짜리 순수 함수 + JSDoc 이고, 스펙(`omit-undefined.spec.ts`)도 falsy 보존·비파괴·얕음·`useDefineForClassFields` 전제까지 네 케이스로 좁고 명확하다.
- `folders.service.ts` 는 함수 길이·중첩·매직 넘버 모두 문제 없다(`MAX_NESTING_DEPTH` 는 이미 이름 붙은 상수, `update()` 는 여전히 짧고 책임이 하나다).
- `folder-crud.e2e-spec.ts` 는 형제 파일(`workflow-crud.e2e-spec.ts`) 의 `A/B/C/D/E` 라벨링·헤더 JSDoc 구조를 그대로 따라 저장소 컨벤션과 일관적이다.
- `CHANGELOG.md` 신규 항목은 파일 상단에 성문화된 "무엇이 항목을 만드는가" 형식(`## Unreleased — <요약>`)을 그대로 따른다.

## 요약

핵심 변경(`omitUndefined` 헬퍼 추출, `folders.service.ts`/`triggers.service.ts` 호출부 축소, `FolderDto.parentId` 선언 정정, 신규 e2e·단위·DTO 캐너리 테스트)은 가독성·함수 길이·중첩·매직 넘버 어느 관점에서도 문제가 없고, 직전 라운드에서 지적된 DRY 위반(WARNING 1)은 실제로 해소됐다. 남은 것은 이미 알려진 두 가지 사소한 잔여물뿐이다 — 케이스 문자 인용 드리프트 처방이 서비스 주석에만 적용되고 단위 테스트 주석엔 안 미쳤다는 점(INFO, 신규 관측), 그리고 새 테스트 2개의 한국어 명명이 같은 블록의 영문 관례와 갈린다는 점(INFO, 기존 처분 재확인). 둘 다 병합을 막을 사유가 아니다.

## 위험도

LOW
