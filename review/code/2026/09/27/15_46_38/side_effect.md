# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 요청 DTO 3개 필드의 공개 인터페이스(타입 + OpenAPI 선언) 확장 — `string`/`string[]` → `string | null`/`string[] | null`
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:62` (`ipWhitelist?: string[] | null`), `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:62` (`description?: string | null`), `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:35` (`description?: string | null`)
  - 상세: 세 PATCH 엔드포인트의 요청 바디 타입과 OpenAPI 스키마(`nullable: true`)가 넓어져, 이 스키마로 생성되는 타입 클라이언트(OpenAPI codegen 등)의 타입도 함께 넓어진다. 이는 공개 API 계약 변경이지만, 커밋 메시지·CHANGELOG(`CHANGELOG.md:26-31`)·plan(`plan/in-progress/patch-body-followups.md`)이 "런타임 동작은 이미 null 을 받아들이고 있었고 동작 변화는 없다, 선언만 사실에 맞춘다"고 명시하며, `nodes.service.ts`/`workflows.service.ts`/`auth-configs.service.ts` 자체는 이번 diff 에 포함돼 있지 않다(grep 결과 서비스 로직 수정 없음) — 실제 merge 경로(`omitUndefined` 기반 shallow-merge)는 원래도 `null` 값을 통과시켰으므로 새 런타임 부작용은 아니다.
  - 제안: 별도 조치 불요. 단, 이 DTO 를 사용하는 프런트엔드/외부 클라이언트가 생성한 타입이 `string`(non-null)을 가정하고 있었다면 재생성이 필요하다는 점만 배포 노트에 남기면 충분.

- **[INFO]** 새 e2e 테스트가 실제 DB 레코드(워크플로·노드·인증설정)를 3건 생성
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` — `describe('PATCH 부분 본문 (e2e)')` 안 `it('E. nullable 필드에 null 을 보내면 값을 지운다 …')`
  - 상세: `POST /api/workflows`, `POST /api/workflows/:id/nodes`, `POST /api/auth-configs` 를 호출해 실제 엔티티를 생성한다. e2e 테스트 환경(고립된 테스트 DB)에서만 실행되며, 같은 파일의 기존 케이스들과 동일한 패턴(`uniqueName`, `authed`)을 따르므로 새로운 종류의 부작용은 아니다.
  - 제안: 조치 불요.

- **[INFO]** JSDoc 전용 변경 — 런타임 영향 없음
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:20-23`
  - 상세: `omitUndefined` 함수 본문(구현)은 변경되지 않았고 문서화(호출부 가드 의무 안내)만 추가됐다. 부작용 없음.

- **[INFO]** plan/review 산출물 신규 파일 생성은 프로젝트 규약대로의 기록 부작용
  - 위치: `plan/in-progress/patch-body-followups.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신), `review/consistency/2026/09/27/15_19_25/*`(신규 6개 파일)
  - 상세: 이들은 `--impl-prep` consistency-check 실행의 정상 산출물이자 `plan/` 라이프사이클 규약이 요구하는 문서다. 코드 변경과 무관한 "예상치 못한 파일시스템 부작용"이 아니다.
  - 제안: 조치 불요.

의도치 않은 전역 상태 변경, 신규 전역 변수, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 배선 변경은 diff 전체에서 관측되지 않았다. `contractForDto`(모듈 레벨 `contractCache` Map)를 테스트에서 새로 import 하지만, 이 헬퍼 자체는 이번 diff 로 도입/수정된 것이 아니라 기존 pre-existing 유틸리티이며 in-memory Nest 스텁 모듈만 부트스트랩할 뿐 디스크/네트워크에 쓰지 않는다.

리뷰 중 저장소 파일을 수정하지 않았다 — `git status --short` 로 확인, 변화 없음(세션 산출 디렉터리 `review/code/2026/09/27/15_46_38/` 외 잔여물 없음).

## 요약

이번 변경은 세 요청 DTO(`UpdateWorkflowDto.description`, `UpdateNodeDto.description`, `UpdateAuthConfigDto.ipWhitelist`)의 타입과 OpenAPI 선언을 `nullable` 로 넓혀 기존에 이미 동작하던 런타임 동작(명시적 `null` → 값 삭제)을 문서·타입에 맞춘 것이 핵심이며, 서비스 로직 자체는 변경되지 않아 새로운 부작용 표면이 생기지 않았다. 나머지 변경은 테스트 캐너리 추가·헬퍼 JSDoc·plan/review 문서화로, 모두 격리된 테스트 환경 또는 문서 영역에 머무른다. 공개 API 계약이 넓어진다는 점만 인지하면 되고(하위 호환, 배포 노트 수준), CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
