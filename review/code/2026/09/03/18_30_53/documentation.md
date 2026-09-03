# 문서화(Documentation) 리뷰 결과

대상: `entity-nullable-column-type-mismatch` 배치 3 (엔티티 8필드 nullable 타입 정정) —
entity 파일 7종 + `folders.controller.ts` + `folders.service.spec.ts` + plan 문서 자체 +
`backend-typecheck-baseline.json` ratchet 값 갱신.

## 발견사항

- **[INFO]** plan 체크리스트 항목이 미체크로 남아 있으나 본문은 이미 완료를 서술
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:337`
  - 상세: `- [ ] 각 배치마다 tsc **비-spec 소스 오류 0** 을 직접 확인 (ratchet 만으로는 부족)`
    항목이 미체크(`[ ]`) 상태다. 그런데 바로 위 §배치 3 절(`:220`)에 "`tsc` 비-spec 오류
    **0** · 가드 **12/12** · ratchet **198/37 → 197/36**" 이 이미 명시돼 있고, 커밋 로그
    (`14ce912f8`)에도 동일 수치가 기록돼 있다. 배치 1(`255aa8597`)·배치 2(`713b69483`)
    커밋 메시지에도 각각 "타입 확장 후 신규 타입 오류 0"이 확인돼 있어, 세 배치 모두 이
    규칙을 실제로 지켰다. 배치 3 절 제목 자체가 "(완료 · 축 종결)"이라 이 plan 이 다루는
    작업은 사실상 끝났는데, 이 cross-batch 체크박스만 갱신에서 빠졌다.
  - 제안: 세 배치 모두 이미 충족된 사실이면 `[x]`로 갱신한다. 만약 이 항목이 "완료할 일"이
    아니라 "매 배치 반복 준수해야 할 규칙 서술"이라는 의도라면(체크박스로 표현하기보다),
    그 취지를 한 줄 덧붙여 다음 리더가 "누락된 확인"으로 오독하지 않게 한다.

- **[INFO]** CHANGELOG.md 미갱신 — plan 이 인용한 선례와 결이 다름
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:52` (선례 인용부),
    CHANGELOG.md (이번 diff에 없음)
  - 상세: 이 plan 문서 자신이 "이 저장소는 같은 클래스를 이미 두 번 고쳤다"며
    `Execution.error` nullable 정정이 CHANGELOG 에 기록된 선례("DB는 처음부터
    `nullable: true`였는데 타입만 그것을 안 적고 있었다")를 인용한다. 그런데 이번 배치
    1·2·3(이 diff 포함) 세 커밋 전부 `CHANGELOG.md`를 갱신하지 않았다(`git diff origin/main
    -- CHANGELOG.md` 공백, 세 커밋 `--stat`에도 CHANGELOG 없음). 세 배치가 일관되게
    생략한 것으로 보아 "순수 내부 타입 정합성 리팩터(런타임 동작 불변, wire 계약 불변)는
    CHANGELOG 비대상"이라는 판단이 이미 서 있는 것으로 보이며, 이는 합리적 구분이다 —
    다만 plan 본문이 인용한 선례는 그 판단과 반대 방향 예시라 다음 사람이 같은 질문을
    반복할 여지가 있다.
  - 제안: 의도된 생략이면 plan 에 "내부 타입 리팩터는 CHANGELOG 비대상(wire 계약·런타임
    동작 불변)"처럼 판단 근거를 한 줄 남겨 둔다. 이미 세 배치가 같은 선택을 반복했으므로
    이 PR 을 막을 사유는 아니다(LOW).

- **[INFO]** `AuthConfigDto.ipWhitelist` nullable 드리프트 — 신규 아님, 이미 plan 에 추적됨(교차 확인)
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:28`
    (이번 diff 밖) / 근거: `plan/in-progress/entity-nullable-column-type-mismatch.md:241`
  - 상세: `AuthConfigDto.ipWhitelist: string[]`(non-null)가 이번에 `| null`로 넓혀진 엔티티
    (`auth-config.entity.ts:43`) 및 spec(`1-data-model.md:621` `String[]?`)과 어긋난다.
    `auth-configs.service.ts:356`은 실제로 `ac.ipWhitelist?.length`로 null 을 다루고
    있어 서비스가 `null`을 반환할 수 있는데 Swagger 문서는 그렇지 않다고 말한다. 이
    드리프트는 이 diff 가 새로 만든 것이 아니라 선재했던 것이며, plan §"새로 드러난 축"이
    이미 49건(12파일) 규모로 실측·기록하고 이번 PR 범위 밖으로 명시적으로 defer했다
    ("한 자리만 고치는 것이 이 plan 이 진단한 안티패턴"). aggregator 가 이 축을 놓치지
    않도록 교차 확인 차 재기재하며, 이 리뷰에서 새로 열 필요는 없다.
  - 제안: 없음 — 이미 plan 에 추적 중이고 defer 사유가 명시돼 있다.

## 교차 검증 (참고용 — 발견사항 아님)

문서화 관점에서 의심 갈 만한 지점을 아래와 같이 직접 대조했고, 전부 정합이 확인돼 별도
기재하지 않았다:

- 7개 엔티티 필드 모두 `spec/1-data-model.md`가 이미 `?`(nullable)로 문서화하고 있었다
  (`ip_address:672/691/706`, `ip_whitelist:621`, `last_used_at:623/768`, `condition:216`,
  `parent_id:135`, `change_summary:575`, `joined_at:109`) — 즉 이 diff 는 스펙을 따라가는
  코드 쪽 정정이라 spec 갱신은 불필요하다.
- `audit_log.ip_address`에 붙은 `type: 'varchar'`의 근거로 plan 이 인용한
  `V001__initial_schema.sql:326 VARCHAR(45)`와 형제 엔티티(`login-history.entity.ts:41`,
  `refresh-token.entity.ts:44`의 `type: 'varchar', length: 45`)를 직접 열어 확인했다 — 인용
  정확.
- `folders.controller.ts`의 `Folder` import 제거 + `dto as Partial<Folder>` 캐스트 제거는
  `Folder.parentId`가 `| null`로 넓혀지면서 `UpdateFolderDto.parentId?: string | null`과
  구조적으로 일치해 캐스트가 불필요해진 것과 정확히 대응한다. `UpdateFolderDto`·`FolderDto`는
  이미 `parentId?: string | null` / `nullable: true`로 정확히 문서화돼 있어 이 diff 로 인한
  새 Swagger 드리프트는 없다.
- `folders.service.spec.ts`의 `parentId: null as unknown as string` → `parentId: null` 제거는
  plan 이 주장한 "무의미한 제거가 아니다(대조군: 엔티티를 `string`으로 되돌리면 오류 2건)"를
  별도로 재현하지는 않았으나, 엔티티 타입 변경과 캐스트 제거가 논리적으로 대응해 이상 없음.

## 요약

이번 diff는 순수 타입 정합성 리팩터(entity nullable 타입 정정)이며, 동반된
`plan/in-progress/entity-nullable-column-type-mismatch.md`가 이례적으로 꼼꼼하게
자기 검증돼 있다 — 인용한 마이그레이션 줄 번호·형제 엔티티 선언·spec 문서 표기까지 전부
직접 대조해 정확함을 확인했다. 코드 쪽에는 JSDoc/README/API 문서를 새로 요구할 만한 공개
표면 변경이 없다(Swagger DTO 는 이미 정확히 nullable로 문서화돼 있었음). 남는 것은 세
가지 저강도 항목뿐이다: (1) plan 의 cross-batch 체크박스 하나가 본문 서술과 불일치한 채
미체크로 남음, (2) CHANGELOG.md 가 plan 자신이 인용한 선례와 다르게 세 배치 모두
갱신되지 않음(의도적일 가능성이 높으나 근거가 문서화되어 있지 않음), (3) 이미 plan 에
추적 중인 `AuthConfigDto.ipWhitelist` Swagger nullable 드리프트를 교차 확인 차 재확인.
셋 다 이 PR 을 막을 사유가 아니다.

## 위험도

LOW
