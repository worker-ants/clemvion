# 유지보수성(Maintainability) 리뷰

## 개요

이번 diff 는 `entity-nullable-column-type-mismatch` 배치 3(엔티티 8필드 nullable TS 타입 정합화) 의
**리뷰 후 정정판**이다 — 이전 라운드(`review/code/2026/09/03/18_30_53/`)의 W1(`AuthConfigDto.ipWhitelist`
Swagger nullable 누락) 조치, CHANGELOG 항목 추가, plan 문서 정리, 그리고 이전 라운드 산출물 자체(13개
리뷰 `.md`/`.json` 파일)가 diff 에 포함됐다. 실제 프로덕션 코드 변경은 여전히 순수 타입 애너테이션
수준(`nullable: true` 컬럼의 TS 타입을 `| null` 로 넓힘) + 불필요해진 캐스트 제거(`folders.controller.ts`,
`folders.service.spec.ts`, `auth.service.spec.ts`) + DTO 1개(`AuthConfigDto.ipWhitelist`) 수정으로,
함수 길이·중첩·복잡도·매직넘버·중복 관점에서 새로 도입된 구조가 없다.

## 발견사항

이전 라운드에서 이 관점(maintainability)이 지적한 유일한 INFO — plan 문서 "배치 3 기준" 체크박스
줄에서 확정 결론과 폐기된 원문 후보 검토 문단이 접속사 없이 붙어 있던 문제 — 를 재확인했다.

`plan/in-progress/entity-nullable-column-type-mismatch.md:340-350` 을 직접 열어 확인한 결과, 제안대로
결론 문장(`- [x] **배치 3 기준** — **"잔여 전량"으로 확정.** ... 상세는 §배치 3 참조.`)과 원문 후보
검토 문단이 `>` 인용 블록으로 명확히 분리되어 있다. 같은 패턴이 `notification.entity.ts` 항목
(`:325-338`)과 `(e)` 항목(`:352-364`)에도 일관되게 적용됐다. **제안대로 조치됐음을 확인** — 재지적할
사항 없음.

그 외 이번 diff 범위(엔티티 7파일 + `folders.controller.ts` + `auth-config-response.dto.ts` + spec
fixture 2건 + CHANGELOG + review 산출물)를 관점별로 훑었으나 새로 도입된 문제는 없다:

- **네이밍/일관성**: `AuthConfigDto.ipWhitelist?: string[] | null` 로의 수정은 같은 DTO 안의
  `lastUsedAt?: string | null` 과 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 형태로
  정확히 일치한다(`codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`).
  `audit_log.ip_address` 의 `type: 'varchar'` 추가도 형제 엔티티(`login-history`·`refresh-token`)와
  데코레이터 키 순서(`name → type → length → nullable`)까지 동일하다.
- **중복 제거**: `folders.controller.ts` 에서 `Folder` import + `dto as Partial<Folder>` 캐스트를
  제거하며 실제로 `Folder`(엔티티) 심볼 참조가 파일에서 완전히 사라졌음을 직접 확인했다(`FolderDto` 는
  별개 심볼로 계속 사용됨) — dead import 잔존 없음.
  (`grep -n "Folder" codebase/backend/src/modules/folders/folders.controller.ts` 로 확인: 남은 참조는
  전부 `FolderDto`.)
- **가독성**: `auth.service.spec.ts:58` `lockedUntil: null as unknown as Date` → `lockedUntil: null`,
  `folders.service.spec.ts:14` `parentId: null as unknown as string` → `parentId: null` 두 곳 모두
  이중 캐스트 잡음이 제거되어 fixture 가독성이 오히려 개선됐다.
- **CHANGELOG 신규 항목**: 표(종전/지금 대조) + spec 인용 + 영향 범위를 갖춘 형태로, 저장소의 기존
  항목(바로 아래 "비밀번호가 없는 사람에게..." 항목) 및 §5.4 규약 인용 스타일과 일관된다.

## 요약

이번 diff 는 이미 LOW 위험도로 판정됐던 순수 타입 정합화 배치에 리뷰 후속 조치(W1 DTO 수정,
CHANGELOG 항목, plan 문서 인용 블록 분리)를 얹은 재검토판이며, 유지보수성 관점에서 새로 도입된
가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성 문제는 발견되지 않았다. 이전 라운드가 지적한
유일한 INFO(plan 문서 문장 접합부)는 소스를 직접 열어 대조한 결과 제안대로 정확히 조치되어 있다.
review 산출물 파일(RESOLUTION.md·SUMMARY.md·개별 reviewer `.md`·`meta.json`·`_retry_state.json`)은
프로젝트 컨벤션(`review/code/<date>/<time>/`)에 맞는 위치에 있고 정형화된 보고서 포맷을 일관되게
따르고 있어 별도로 지적할 구조적 결함이 없다.

## 위험도

NONE
