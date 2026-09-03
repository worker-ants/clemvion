# 변경 범위(Scope) 리뷰 — entity nullable 타입 정합 배치 3 (재검증 라운드)

## 개요

`git diff --stat origin/main...` 로 실제 커밋 파일 26개 전량을 프롬프트의 26개 파일 목록과 대조했다 — 완전히 일치한다(누락·과다 없음). 이번 diff 는 세 층으로 구성된다.

1. `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3 — 엔티티 8필드(컬럼 7·relation 1)의 TS 타입을 `| null` 로 넓히는 작업 (파일 2·4·6·7·10·11).
2. 그 타입 확장의 **직접 파생**인 캐스트 제거 3건 — `folders.controller.ts`(`dto as Partial<Folder>` + `Folder` import), `folders.service.spec.ts`(`parentId: null as unknown as string`), `auth.service.spec.ts`(`lockedUntil: null as unknown as Date`) (파일 5·8·9).
3. 이전 리뷰 라운드(`18_30_53`)가 남긴 **WARNING 1건에 대한 대응** — `AuthConfigDto.ipWhitelist` nullable 정정(파일 3) + CHANGELOG 항목(파일 1) + 그 라운드의 리뷰 산출물 13개 파일 커밋(파일 13~25) + ratchet baseline 갱신(파일 26).

## 발견사항

- **[INFO]** `AuthConfigDto.ipWhitelist` 정정(파일 3)은 "엔티티 nullable 타입 정합" 배치 타이틀 자체의 직접 범위(entity 파일)를 벗어나 Swagger/OpenAPI 응답 DTO 를 건드린다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`
  - 상세: 그러나 이는 developer 가 임의로 넓힌 기능 확장이 아니라, 직전 리뷰 라운드(`review/code/2026/09/03/18_30_53/`)의 api_contract 리뷰어 WARNING("이 필드가 실제로 null 을 반환하는데 스키마가 아니라고 말한다")에 대한 응답이다. `RESOLUTION.md` 가 API 규약 §5.4("변경되는 필드"에만 적용)를 근거로 이 1필드에만 한정했고, 같은 축의 나머지 48건은 "여전히 별개 축"으로 명시적으로 스코프 아웃했다 — 한 자리만 임의로 고친 것이 아니라 규약이 그은 경계를 그대로 따른 것이다. fix→재리뷰 사이클의 정상적인 산물로 판단해 스코프 위반으로 보지 않는다.
  - 제안: 조치 불필요. (참고용 기재)

- **[INFO]** `review/code/2026/09/03/18_30_53/*.md`·`*.json` 13개 신규 파일(파일 13~25)이 이번 diff 에 포함되어 파일 수·삽입 줄 수(1,041줄 중 상당수)가 크게 부풀어 보인다.
  - 위치: `review/code/2026/09/03/18_30_53/` 디렉터리 전체(신규 파일)
  - 상세: 코드 변경이 아니라 **직전 리뷰 라운드 자신의 산출물**을 커밋한 것이다. `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 정보 저장 규약과 일치하고, 이번 diff 의 코드 변경(엔티티 8필드 + 파생 캐스트 3건 + W1 대응 1건)과 논리적으로 대응한다. 무관한 파일 유입이 아니다.
  - 제안: 조치 불필요.

- 그 외 점검한 항목 — 문제 없음:
  - **의도 이상의 변경**: 넓혀진 8필드는 plan §배치3 이 명시한 "잔여 전량"과 정확히 일치(6개 엔티티 파일). `AuditLog.ipAddress` 에만 `type: 'varchar'` 가 추가됐는데, 이는 마이그레이션(`V001__initial_schema.sql:326` `VARCHAR(45)`)·형제 엔티티(`login-history`·`refresh-token`) 선례와 일치하는 근거 있는 예외이며 plan 본문에 실측으로 기록돼 있다.
  - **불필요한 리팩토링**: `@Column` 데코레이터 키 순서 재정렬(예: `notification.entity.ts`)은 plan `entity-nullable-column-type-mismatch.md` 안에서 **won't-do 로 명시 결정**됐고 이 diff 에 포함되지 않았다 — 스코프 확대를 스스로 차단한 흔적.
  - **기능 확장**: 없음. `folders.controller.ts` 캐스트 제거는 `Folder.parentId` 타입 확장에 따라 `UpdateFolderDto` 와 구조적으로 이미 일치해 캐스트가 무의미해진 결과이지 새 기능이 아니다.
  - **무관한 파일 수정**: `scripts/backend-typecheck-baseline.json` 은 캐스트 제거로 사라진 타입 오류 1건(`folders.service.spec.ts`)을 반영한 자동 생성 산출물(`total: 198→197`, 해당 엔트리 삭제)이며 손편집 흔적 없음.
  - **포맷팅/주석/임포트**: `folders.controller.ts` 의 `Folder` import 제거는 캐스트 제거로 미사용이 된 것의 자연스러운 정리. 그 외 순수 포맷팅 변경은 발견되지 않음.
  - **설정 변경**: 없음(baseline json 은 자동 생성 ratchet 값이지 손으로 조정한 설정이 아님).

## 요약

이번 diff 26개 파일은 (1) plan 배치 3 이 명시한 엔티티 8필드 타입 확장, (2) 그 확장의 필연적 파생인 캐스트 제거 3건, (3) 직전 리뷰 라운드 WARNING 에 대한 규약 근거 있는 좁은 대응(`AuthConfigDto.ipWhitelist` + CHANGELOG) 및 그 라운드 산출물 커밋, (4) 자동 생성된 ratchet baseline 갱신으로 정확히 설명된다. `git diff --stat` 실측으로 파일 목록 누락·과다가 없음을 확인했고, plan 문서 자체가 각 파생 변경(캐스트 제거 2곳→3곳, won't-do 결정 등)의 근거를 대조군 실측과 함께 이례적으로 꼼꼼히 기록하고 있다. 의도 이상의 변경, 무관한 리팩토링, 요청되지 않은 기능 확장, 무관한 파일·설정 수정은 발견되지 않았다.

## 위험도

NONE
