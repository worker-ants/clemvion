# 정식 규약 준수 검토 — Convention Compliance

## 검토 개요

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 델타는 0(코드 전용 PR) — 검토 대상은 diff 10파일/152줄
  (엔티티·응답 DTO의 `nullable: true` 컬럼 ↔ TS 타입 불일치 정정, 브랜치
  `plan/in-progress/entity-nullable-column-type-mismatch.md` §배치 3).
- 실제 `git diff origin/main...HEAD` 로 대조해 번들 diff 가 stale 하지 않음을 확인했다
  (동일 10파일).

## 발견사항

### [INFO] `null`-present 필드의 DTO 선언 패턴이 파일 내에서 두 갈래다
- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
  — 이번 diff 가 고친 `AuthConfigDto.ipWhitelist` (L27-28) vs 같은 파일의
  손대지 않은 `AuthConfigUsageCallDto.sourceIp` (L84-88)
- 관련 규약: `spec/5-system/2-api-convention.md §5.4` (부재 표현 — `null` vs 키 생략) +
  `spec/conventions/swagger.md §1-3`
- 상세: 이번 diff 는 §5.4 문면을 그대로 따라 `ipWhitelist`를
  `@ApiPropertyOptional({ nullable: true })` + `ipWhitelist?: string[] | null`
  로 고쳤다(§5.4 규정과 글자 그대로 일치, 규약 준수). 그런데 같은 파일의 `sourceIp`
  는 "캡처되지 않은 호출은 null"이라는 **동일한 의미**(상시 존재·값만 null)를 갖는데도
  `@ApiProperty({ nullable: true })`(Optional 아님) + `sourceIp: string | null`(`?` 없음)
  로 선언돼 있다. §5.4 표는 `null`(키 present) 을 "이 필드는 응답 계약에 **상시 존재**"라고
  정의해 놓고, 바로 아래 DTO 선언 규칙 문장은 그 경우에도 `field?: T | null`(TS-optional
  마커)을 쓰라고 적어 "상시 존재"라는 의미와 `?`(may-be-absent)라는 표기가 어긋난다.
  `tsconfig.json`(`strictPropertyInitialization` 미설정)을 확인한 결과 `?` 는 컴파일 요구사항이
  아니라 순수 표기 선택이라, 같은 의미의 두 필드가 왜 다르게 선언됐는지 규약만으로는
  설명되지 않는다.
- 제안: 이번 diff 자체는 §5.4 문면을 정확히 따랐으므로 **diff 를 되돌릴 필요는 없다**.
  다만 (a) `sourceIp` 를 `ipWhitelist` 패턴에 맞출지, 아니면 (b) §5.4 문장에서
  "null 표현" 케이스의 `field?:` 를 `field:`(non-optional) 로 정정해 `sourceIp` 선례에
  맞출지 — 규약 자체의 표기를 planner 턴에서 한 번 정리하는 편이 다음 필드 추가 때
  같은 갈림이 반복되는 것을 막는다. (`entity-nullable-column-type-mismatch.md` §배치 3 이
  이미 "엔티티 nullable ↔ 응답 DTO 선언" 축에 가드가 없다고 자체 기록해 뒀다 — 이
  갈래도 그 가드 설계 시 같이 정리할 수 있다.)

### [INFO] `/api/auth/*` 액션 네임스페이스가 §2.2 명명 예외 목록에 없음 — 본 diff 무관, 이미 추적됨
- target 위치: `spec/5-system/2-api-convention.md §2.2` (URL 명명 규칙)
- 관련 규약: 동 문서 §2.2 표의 "RPC-style sub-channel action" / "`/api/external/*`" 두
  예외 항목
- 상세: `plan/in-progress/entity-nullable-column-type-mismatch.md` (§할 일) 가 이미
  "`/api/auth/{verb}` 15개 이상이 §2.2 의 두 예외 어디에도 포섭되지 않는다"를
  developer 권한 밖 후속(planner 턴 대기)으로 등재해 뒀다. 본 diff 의 변경분과는 무관한
  선재 gap이다.
- 제안: 신규 조치 불요 — 이미 plan 에 planner 턴 항목으로 올라가 있으므로 중복 등재만
  피하면 된다. (중복 방지 목적으로 본 리포트에 기록)

## 요약

이번 diff(엔티티·DTO nullable 타입 정정, 10파일/152줄)는 정식 규약을 위반하지 않는다.
유일한 API 표면 변경인 `AuthConfigDto.ipWhitelist` 는 `spec/5-system/2-api-convention.md §5.4`
("`null`-present 필드는 `@ApiPropertyOptional({nullable:true})` + `field?: T|null`")를
문면 그대로 따랐고, plan 문서(`entity-nullable-column-type-mismatch.md`)가 그 근거(§5.4
"신규 변경 필드에 한정" 조항)까지 명시적으로 인용해 스코프를 정당화했다. 남은 47건/25파일의
동일 축(entity nullable ↔ 응답 DTO 선언 불일치) 부채는 §5.4 의 소급 비적용 조항에 따라
이번 diff 의 책임 범위 밖이며 이미 plan 에 후속으로 등재돼 있다. 발견한 것은 CRITICAL/WARNING
이 아니라, §5.4 규약 문면 자체의 `field?:` 표기가 "상시 존재" 정의와 다소 어긋나 보이고
기존 코드(`sourceIp`)와 다른 패턴을 만든다는 표기 수준의 INFO 2건뿐이다.

## 위험도
NONE
