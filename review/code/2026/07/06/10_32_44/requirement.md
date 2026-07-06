# 요구사항 충족 리뷰 — 워크플로우 목록 폴더 필터 UI (FE-2)

- 대상 커밋: `6279d01b6` (1 commit, `git diff origin/main...HEAD`)
- 관련 spec: `spec/2-navigation/1-workflow-list.md` §2.3(필터), §3.1(폴더 관리 API)
- 범위: 폴더 필터만. 태그 필터·§2.7 마켓플레이스 링크는 의도적 제외(별도 트랙) — 결함 아님.

## 발견사항

- **[WARNING]** 워크스페이스 전환 시 `folderId` 선택 상태와 `folders` 캐시가 리셋되지 않음
  - 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx:102-108` (workspace subscribe effect), `:142-146` (`foldersQuery`)
  - 상세: 같은 파일의 `ownership` state 는 `useWorkspaceStore.subscribe`로 워크스페이스 전환 시 `"all"`로 명시적으로 리셋한다(주석: "워크스페이스를 전환하면 ownership 을 'all' 로 리셋"). 반면 이번 diff 로 추가된 `folderId` 는 같은 effect 에서 리셋되지 않는다. 또한 `foldersQuery` 의 `queryKey: ["folders"]` 는 워크스페이스 식별자를 포함하지 않아, 워크스페이스 A 에서 로드된 폴더 목록이 staleTime(전역 기본 60s, `providers.tsx`) 동안 워크스페이스 B 전환 후에도 캐시로 남을 수 있다. 두 문제가 겹치면: A 에서 폴더 X 선택 → B 로 전환 → (a) select 옵션이 A 의 폴더 목록을 잠시 보여주거나, (b) B 에 폴더 X 가 없어 옵션 목록에서 사라졌는데도 `folderId=X` 가 `?folderId=X` 로 계속 서버에 전송됨. 서버는 `w.workspace_id = :workspaceId AND w.folder_id = :folderId` 조합이라 크래시 없이 조용히 0건을 반환하지만(`workflows.service.ts:74,87-88`), 사용자는 필터 select 에 아무 폴더도 선택되지 않은 것처럼 보이는 채로 "결과 없음" 화면을 보게 되어 원인 파악이 어렵다.
  - 제안: workspace subscribe effect 에 `setFolderId("")` 를 `setOwnership("all")` 과 함께 추가하고, `foldersQuery` 의 `queryKey` 에 `currentWorkspaceId` (또는 동등 키)를 포함해 워크스페이스 전환 시 폴더 목록도 함께 무효화되도록 한다.

- **[INFO]** 선택된 폴더가 삭제된 뒤의 select 표시 상태는 spec 이 침묵하는 영역
  - 위치: `page.tsx:447-465` (`folders.length > 0` 렌더 가드), `foldersQuery`
  - 상세: 폴더 선택 후 해당 폴더가 삭제되면(§3.1 DELETE, FK `SET NULL` 로 워크플로는 루트로 이동) 백그라운드에서 `foldersQuery` 가 리페치될 경우 `folders` 배열에서 선택된 폴더가 사라지고, controlled `<select value={folderId}>` 는 목록에 없는 값을 가리켜 브라우저가 "선택 없음"으로 렌더링할 수 있다. 그런데 `folderId` state 자체는 삭제된 값 그대로 남아 `?folderId=<삭제된 ID>` 를 계속 전송한다 — 서버는 해당 폴더가 더 이상 없으므로 0건 매치(에러 아님)를 반환한다. spec §2.3/§3.1 본문에 이 케이스에 대한 명시 요구가 없어 결함으로 단정하기는 어렵지만, UX 상 "필터를 안 걸었는데 결과가 없다"는 혼란 가능성이 있다.
  - 제안(참고용, 결함 아님): `foldersQuery.isSuccess` 시점에 `folders` 에 현재 `folderId` 가 없으면 자동으로 리셋하는 방어 로직을 planner 검토 대상으로 남길 수 있음. 이번 리뷰에서는 차단 사유로 보지 않음.

- **[INFO]** `folderId` 빈 문자열 → `null` 변환(DTO `@Transform`) 및 "빈 문자열=루트 폴더" 주석은 이번 diff 의 프론트 코드와 무관한 기존 백엔드 이슈
  - 위치: `codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts:30-39`, `workflows.service.ts:87-88`
  - 상세: DTO 주석은 "폴더 단일 필터. 빈 문자열일 경우 루트 폴더로 간주"라고 되어 있으나, `@Transform` 이 빈 문자열을 `null` 로 바꾸고 `service.ts` 의 `if (folderId)` 가 falsy(`null`) 를 걸러 조건절 자체를 건너뛰므로 "루트 폴더만" 필터링하는 동작은 실제로 존재하지 않는다(전체 워크플로가 반환됨). 다만 이번 FE-2 diff 는 애초에 빈 문자열을 전송하지 않고 값이 있을 때만 `params.folderId = folderId` 로 보내므로(`page.tsx:184`), 이 프론트 구현은 그 기존 백엔드 갭의 영향을 받지 않고 spec §2.3("폴더 선택(있을 경우)")의 "선택 시 필터 적용" 요구를 정확히 충족한다. 이 항목은 FE-2 범위 밖의 별도 백엔드 이슈로 기록만 해둔다(차단 사유 아님).
  - 제안: FE-2 범위에서 조치 불필요. 별도 backend 이슈로 planner 트래킹 검토 권장(선택).

## Spec 정합성 점검 (§2.3, §3.1)

- §2.3 "폴더 | 폴더 선택 (있을 경우) | 미구현" 행 → 이번 구현으로 "미구현" 이 해소됨. `folders.length > 0` 가드(`page.tsx:447`)로 폴더가 0개인 워크스페이스에서는 필터 자체가 렌더되지 않아 spec 문구("있을 경우")와 일치한다.
- §3.1 "프론트엔드는 본 API 를 아직 소비하지 않는다" 서술은 이번 구현으로 stale 화 됨 — 이는 코드 결함이 아니라 spec 본문이 뒤처진 것(`[SPEC-DRIFT]`, 아래 항목).
- `plan/in-progress/spec-sync-workflow-list-gaps.md` 는 이미 이번 커밋에서 §2.3 폴더 행 체크(`[x]`)와 §3.1 대응 진행 노트로 갱신됨 — plan 갱신 자체는 적절하나, spec 본문(§3.1 "아직 소비하지 않는다" 문장, §2.3 표의 "미구현 (Planned)" 문구)은 별도이며 아직 갱신되지 않았다.

- **[SPEC-DRIFT]** §2.3 폴더 필터 행의 "미구현 (Planned)" 및 §3.1 "프론트엔드는 본 API 를 아직 소비하지 않는다 — 폴더 필터·폴더 관리 UI 모두 없음" 서술이 이번 구현으로 낡음
  - 위치: `spec/2-navigation/1-workflow-list.md:75` (§2.3 표 폴더 행), `:133` (§3.1 안내문)
  - 상세: 이번 diff 로 `page.tsx` 가 `GET /folders` 를 소비해 폴더 필터 select 를 렌더하고 `?folderId=` 를 송신하는 구현이 완료됐다. 이는 실수가 아니라 FE-2 로 의도적으로 완성된 기능이며, spec 본문의 "미구현"/"아직 소비하지 않는다" 서술만 뒤에 남아 실제(true) 상태와 어긋난다. `plan/in-progress/spec-sync-workflow-list-gaps.md` 진행 노트에는 이미 "폴더 필터 UI(§2.3) frontend 완료"로 기록돼 plan 레벨에서는 인지돼 있으나, spec 문서 자체의 갱신은 아직이다(§2.3 표 "미구현 (Planned)" → "폴더 존재 시 노출, `?folderId=` 송신" 류 서술로, §3.1 안내문 → "프론트엔드가 폴더 필터 select 로 소비함" 류로).
  - 제안: 코드 변경 불필요. `project-planner` 가 `spec/2-navigation/1-workflow-list.md` §2.3 표 폴더 행과 §3.1 안내 문단을 구현 완료 상태로 갱신(및 필요 시 §1 목업 상단 주석 "태그·폴더 필터 UI 는 아직 미구현" 문구에서 "폴더" 제거). 태그 필터는 여전히 미구현이므로 그 부분 문구는 유지.

## 요약

폴더 필터 UI 구현은 spec §2.3/§3.1 이 요구하는 핵심 동작(폴더 존재 시에만 노출, 선택 시 `?folderId=` 송신, 미선택 시 미송신, page 리셋, resetFilters 연동, i18n)을 정확히 충족하며 테스트도 이 경로들(빈 폴더 숨김/렌더/필터 전송/page 리셋/active-filter 판정/reset 복귀)을 꼼꼼히 커버한다. 다만 같은 파일에 이미 존재하는 "워크스페이스 전환 시 필터 리셋" 패턴(`ownership`)을 신규 `folderId` state 에는 적용하지 않아 워크스페이스 전환 후 스테일 폴더 필터가 조용히 걸린 채 남을 수 있는 WARNING 하나가 있다. 나머지는 spec 이 침묵하는 회색지대(INFO)이거나 FE-2 범위 밖 기존 백엔드 이슈(INFO)이며, spec 본문의 "미구현" 서술이 낡은 SPEC-DRIFT 1건은 코드가 아닌 spec 갱신 대상이다. 전반적으로 기능 완전성·엣지케이스 처리 수준은 높다.

## 위험도

LOW
