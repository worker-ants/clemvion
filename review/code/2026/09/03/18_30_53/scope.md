# 변경 범위(Scope) 리뷰 — nullable 컬럼 타입 정합 배치 3

## 발견사항

- **[INFO]** `folders.controller.ts` 의 캐스트/임포트 제거는 엔티티 파일 변경의 직접 파생이지만 plan 본문에 명시적으로 서술돼 있지 않음
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:35`(임포트 제거), `114`(`dto as Partial<Folder>` → `dto`)
  - 상세: `Folder.parentId` 가 `string` → `string | null` 로 넓혀지면서(같은 커밋의 `folder.entity.ts` 변경) `UpdateFolderDto`(`parentId?: string | null`)가 `Partial<Folder>` 에 구조적으로 그대로 부합하게 돼, 기존의 `as Partial<Folder>` 캐스트가 불필요해졌다. 이 캐스트는 바로 이 plan 이 진단하는 "타입이 nullable 불일치를 감추는" 패턴의 또 다른 사례이므로 제거가 타당하고, 캐스트 제거로 `Folder` 타입 임포트도 자연히 미사용이 되어 함께 제거된 것도 정합적이다. 다만 plan 문서(`entity-nullable-column-type-mismatch.md`)의 배치 3 절은 같은 클래스의 캐스트 제거로 `folders.service.spec.ts:14` 의 `null as unknown as string` 만 명시하고, 이 컨트롤러 캐스트 제거는 언급하지 않는다.
  - 제안: 기능적으로 문제는 없으나(엔티티 변경의 직접 결과이고 리뷰 대상 파일 목록에도 포함됨), plan 의 "새로 드러난 축"/배치 3 요약에 이 캐스트 제거 1건을 한 줄 추가해 두면 이 plan 이 스스로 강조하는 "완료·정정 주장은 grep 으로 확인" 원칙과 문서-코드 정합이 더 깨끗해진다.

## 요약

리뷰 대상 10개 파일은 모두 `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3(잔여 8필드: `audit_log.ipAddress`, `auth_config.ipWhitelist`/`lastUsedAt`, `edge.condition`, `folder.parentId`/`parent`, `workflow_version.changeSummary`, `workspace_member.joinedAt`)와 정확히 대응한다. `type: 'varchar'` 추가는 `audit_log.ipAddress` 1건뿐이며 이는 마이그레이션·형제 컬럼 선례와 일치하고, 나머지 컬럼은 이미 `type:` 이 명시돼 있거나(`ipWhitelist`·`condition`·`changeSummary`·`joinedAt`) `@JoinColumn` 예외(`folder.parentId`)에 해당해 plan 이 정의한 두 단계 규칙(넓히기 + `type:` 확인)과 어긋나지 않는다. `folders.service.spec.ts` 의 `null as unknown as string` 캐스트 제거, `folders.controller.ts` 의 `as Partial<Folder>` 캐스트 및 대응 임포트 제거는 모두 같은 커밋에서 넓혀진 `Folder.parentId` 타입 변경의 직접적·필연적 파생이며 실질적으로 다른 목적의 리팩토링이 섞여 있지 않다. `scripts/backend-typecheck-baseline.json` 의 `198→197`, `folders.service.spec.ts` 엔트리 제거는 캐스트 제거로 사라진 타입 오류 1건을 반영하는 자동 생성 산출물로 손편집 흔적이 없다. `@Column` 데코레이터 키 순서·공백 등 포맷팅은 형제 엔티티 관례(`name→type→length→nullable`)와 일관되어 별도의 무관한 리포맷팅으로 보이지 않는다. plan 문서 자체의 대규모 추가는 이 저장소 컨벤션상 작업 진행 기록이며 스코프 위반이 아니다. 전반적으로 의도 이상의 변경, 무관한 리팩토링, 기능 확장, 설정 파일의 임의 변경은 발견되지 않았다.

## 위험도
NONE
