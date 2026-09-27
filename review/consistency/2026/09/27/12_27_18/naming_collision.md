# 신규 식별자 충돌 검토 — folders-contract-e2e

## 검토 범위 재확인

- `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`.
- `spec/2-navigation/` 자체의 델타는 0개 파일이다 (코드 전용 PR). 신규 식별자는 실제로 `codebase/backend` 쪽 diff(9파일/425줄, `_code_diff.patch`)에서 도입됐으므로 그쪽을 1차 근거로 분석했다 (HEAD `91be1e30d`, 워크트리 절대경로 기준).
- diff 요약: `omitUndefined` 헬퍼 신설(`common/utils/omit-undefined.ts`) + `folders.service.ts`/`triggers.service.ts` 두 인라인 사본을 그 헬퍼 호출로 교체, `FolderDto.parentId` 선언을 `@ApiPropertyOptional` → `@ApiProperty(nullable)`로 변경, 신규 e2e `test/folder-crud.e2e-spec.ts`, CHANGELOG 항목 1건, `swagger-dto-contract.spec.ts`의 drift 화이트리스트에서 `folder-response.dto.ts:FolderDto.parentId` 한 줄 제거.

## 발견사항

- **[WARNING]** 신규 `omitUndefined` 와 기존 `omitKeys` 가 같은 파일(`triggers.service.ts`)에서 `omit*` 접두로 공존 — 의미는 정반대
  - target 신규 식별자: `omitUndefined` (`codebase/backend/src/common/utils/omit-undefined.ts:9` 신설, `codebase/backend/src/modules/triggers/triggers.service.ts:44` import, `:622` 사용, `codebase/backend/src/modules/folders/folders.service.ts:8`,`:75` 에서도 사용)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:143` `function omitKeys(source, strip: ReadonlySet<string>)` — PATCH 응답 직렬화 시 `botTokenRef`/`triggerToken` 같은 **명시적으로 이름을 지정한 비밀 키**를 제거하는 응답-redaction 헬퍼(모듈-로컬, `stripChatChannelSecrets`/`stripInteractionSecrets` 등이 호출).
  - 상세: 두 함수 모두 "객체에서 일부 키를 제외한 얕은 사본을 만든다"는 동일한 shape(`Record`/객체 in → 부분집합 객체 out)를 가지면서 이름도 `omit` 접두를 공유한다. 그러나 목적이 반대다 — `omitKeys`는 **특정 키 이름**을 지목해 응답에서 지우는 redaction 용도(입력이 아니라 출력 방향)이고, 신규 `omitUndefined`는 **값이 `undefined`인 키**를 걸러 PATCH 부분 본문을 엔티티에 `Object.assign`하기 전에 정제하는 입력 방향 용도다. 425줄 diff가 `omitUndefined` 를 `triggers.service.ts:622`에 도입하면서, 같은 파일 111줄 위(:143)에 이미 있던 `omitKeys` 와 이름·shape 이 나란히 놓이게 됐는데, 파일 안 어디에도 두 헬퍼를 서로 참조하거나 구분하는 주석이 없다(`omitUndefined` 호출부 주석은 `omit-undefined.ts` JSDoc만 가리킨다). 실제 충돌(같은 이름을 다른 의미로 재사용)은 아니라서 CRITICAL 은 아니지만, 향후 유지보수자가 "이 파일엔 이미 omit 계열 헬퍼가 있으니 재사용하자"며 `omitKeys`를 undefined-필터링 자리에 잘못 끌어쓰거나 반대로 혼동할 위험은 실재한다.
  - 제안: 필수는 아니지만, `omitUndefined` 호출부(`triggers.service.ts:619-622`) 또는 `omitKeys` JSDoc(`:136-142`)에 "이 파일에는 이름이 비슷한 두 헬퍼가 있다 — `omitKeys`는 명시 키 redaction(출력), `omitUndefined`는 undefined 값 필터링(입력 병합 전)" 한 줄 상호 참조를 추가하면 향후 혼동을 차단할 수 있다. 강제 조치는 아니므로 비차단 권고로 남긴다.

## 검토했으나 충돌 없음으로 확인한 항목

- `omitUndefined` 정의는 `common/utils/omit-undefined.ts` 단 한 곳뿐이고(`git grep` 재확인), frontend/packages 어느 쪽에도 동명 식별자가 없다.
- `FolderDto`는 기존에 이미 존재하던 엔티티명이고 이번 PR은 `parentId` 필드의 데코레이터(`@ApiPropertyOptional` → `@ApiProperty`)만 바꿨다 — 신규 엔티티/타입명 도입이 아니다. `CreateFolderDto`/`UpdateFolderDto`와도 이름 겹침 없음.
- `test/folder-crud.e2e-spec.ts`는 신규 파일이며 `origin/main`에 동일 경로가 없다(`git show origin/main:...` 확인). 네이밍도 형제 파일 `workflow-crud.e2e-spec.ts`와 동일한 `<domain>-crud.e2e-spec.ts` 컨벤션을 그대로 따른다 — 컨벤션 이탈 없음.
- `common/utils/omit-undefined.ts` 파일명은 같은 디렉터리의 `assert-row-array.ts`/`process-in-batches.ts`/`with-timeout.ts`/`update-returning-rows.ts` 등 접미사 없는 kebab-case 그룹과 일치한다 — 파일 경로 컨벤션 이탈 없음.
- 신규 API endpoint·요구사항 ID·webhook/queue/SSE 이벤트명·ENV var·config key 는 이번 diff에 전혀 도입되지 않았다(스코프 spec 델타 0과 일치). `swagger-dto-contract.spec.ts`의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열에서 한 항목을 제거한 것은 식별자 신설이 아니라 화이트리스트 축소.
- CHANGELOG 신규 항목("## Unreleased — 폴더 수정 응답이 보내지 않은 필드를 틀리게 싣지 않는다")은 기존 "## Unreleased —" 제목들과 문구가 겹치지 않으며, 기존 폴더 관련 CHANGELOG 항목도 없어 중복이 없다.

## 요약

이번 diff는 spec 델타가 없는 코드 전용 PR로, 도입되는 신규 식별자는 `omitUndefined` 헬퍼·그 파일 경로·`folder-crud.e2e-spec.ts`·CHANGELOG 제목 정도로 표면이 작다. 전수 grep 결과 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 중 어느 축에서도 기존 사용처와의 실질적 충돌(CRITICAL)은 발견되지 않았다. 유일한 지적은 신규 `omitUndefined`가 같은 파일에 이미 있던 `omitKeys`와 이름·shape가 유사하면서도 입력 정제 vs 출력 redaction으로 목적이 반대라는 점으로, 실충돌이 아닌 향후 혼동 가능성 수준의 WARNING이다.

## 위험도

LOW
