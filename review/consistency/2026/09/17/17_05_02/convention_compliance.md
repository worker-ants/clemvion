# 정식 규약 준수 검토 — spec-draft-deletion-releases-trigger-resources

대상: `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md` (--spec 모드, 2차 개정판 —
1차 `--spec` BLOCK, `review/consistency/2026/09/17/16_32_44` 후속)

## 검토 방법

번들에 포함된 `spec/conventions/secret-store.md`·`audit-actions.md` 전문과, 컨텍스트 예산 초과로
번들에서 절단된 `migrations.md`·`spec-impl-evidence.md`·`redis-keys.md` 는 워크트리에서 직접 열어
전문을 대조했다. target 이 수정을 제안하는 7개 spec 파일(`spec/2-navigation/1-workflow-list.md`·
`2-trigger-list.md`, `spec/data-flow/10-triggers.md`·`11-workflow.md`·`12-workspace.md`,
`spec/1-data-model.md`, `spec/conventions/secret-store.md`) 의 **현재 frontmatter·표 구조·앵커**를
직접 열어 diff 전후 정합을 확인했다.

## 발견사항

- **[INFO]** S10 의 frontmatter 지시문이 "신규 필드 추가"와 "기존 배열에 append"를 구분하지 않는다
  - target 위치: `## 변경안 § S10` 마지막 줄 — `frontmatter — status: implemented → partial,
    pending_plans: 에 plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/spec-impl-evidence.md` §2 스키마 예시와 표현 관례
  - 상세: `secret-store.md` 현재 frontmatter 는 `id`/`status`/`code` 세 키뿐이고 `pending_plans:` 가
    아예 없다(실측 — 워크트리 파일 직접 확인). "pending_plans: 에 … 추가" 라는 문구는 이미 배열이
    있고 원소를 더하는 것처럼 읽혀, S1(`1-workflow-list.md` — 이미 `pending_plans:` 배열 보유)과
    같은 문구를 재사용했지만 두 파일의 실제 시작 상태가 다르다. 적용자가 오독할 여지는 작지만
    (다른 partial 문서의 스키마가 이미 예시로 있어 형태를 유추 가능), 다른 자리(S1/S8/S9)가 모두
    "무엇에서 무엇으로" 형태의 명시적 diff 를 쓰는 것과 비교하면 이 항목만 결과 형태를 생략한다.
  - 제안: `pending_plans:` 필드를 새로 추가하는 것임을 명시(`(신규 필드)` 등 한 단어)하거나, S1 처럼
    변경 전/후 YAML 스니펫을 붙인다.

## 확인한 정합성 (참고 — 새 결함 아님)

아래는 1차 `--spec` BLOCK(Critical 2)이 지적한 지점과 인접 규약을 재확인한 결과다. 모두 통과.

- **`spec-impl-evidence.md` frontmatter 스키마 준수**: `secret-store.md`(S10)·`1-workflow-list.md`(S1)
  은 `spec/conventions/**`·`spec/2-navigation/**` 로 §1 적용 대상이 맞고, `status: partial` 전이 시
  `code:` ≥1 매치(기존 유지)·`pending_plans:` 실존(대상 파일 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 가 실제로 워크트리에 존재 — `spec-pending-plan-existence.
  test.ts` 요건) 둘 다 충족. `spec/1-data-model.md` 는 `EXCLUDE_BASENAMES` 대상이라 frontmatter
  가드 밖이고, target(S8)도 `implemented` 를 그대로 두어 이 배제를 정확히 반영했다.
- **`spec/data-flow/**` frontmatter 면제 + 인라인 표기 관례**: S5~S7 이 `spec/data-flow/10-triggers.md`
  ·`11-workflow.md`·`12-workspace.md` 에 frontmatter 대신 본문 **"미구현 (Planned)"** 표기를 쓴 것은
  이 디렉토리의 기존 관례(`4-file-storage.md`·`9-observability.md`·`8-notifications.md` 에 동일 표기
  선례 확인)와 정확히 일치한다.
  `1차 --spec` W1 처분("data-flow 문서는 frontmatter 가 없어 문중 표기")이 실제로 성립한다.
- **앵커 무결성(`spec-link-integrity.test.ts`, build 차단)**: target 이 추가/인용하는 앵커
  (`2-trigger-list.md#43-cascade-동작`, `#44-결과에러`, `#3-api`, `secret-store.md#r4-trigger-fk-미설정`)
  모두 대상 heading("### 4.3 cascade 동작"·"### 4.4 결과·에러"·"## 3. API"·"### R4. Trigger FK 미설정")
  과 slug 가 일치함을 확인. S10 이 `secret-store.md` §6 제목을 바꾸면서 옛 제목의 앵커
  (`#6-trigger-삭제-시-cascade`) 를 참조하는 자리가 `spec/`·`codebase/`·`plan/` 전체에 0건임을 재확인
  (target 의 실측 주장과 grep 결과 일치) — 제목 변경이 링크 가드를 깨지 않는다.
- **`audit-actions.md` 명명 정합**: D2 에서 언급된 `trigger.deleted`·`workflow.deleted` 는 레지스트리
  (§3, trigger/workflow 과거분사 구현 항목)에 이미 등재된 값이라 새 명명 충돌이 없다. D2 가 기각한
  대안(트리거마다 개별 삭제 엔드포인트 호출)이 만들 "동일 사용자 행위에 복수 감사 행"은 같은 문서의
  "짝 리소스는 호출된 엔드포인트 쪽만 기록한다" 원칙과 같은 방향의 근거이며 이를 위반하지 않는다.
- **`redis-keys.md`/BullMQ 네이밍**: 실측 표의 `schedule:<id>` job scheduler 식별자는 이미
  `spec/data-flow/10-triggers.md §1.4`(`upsertJobScheduler('schedule:<id>', …)`)에 선례가 있는 표기이고,
  `redis-keys.md §3`("BullMQ 큐 내부 `bull:<queue>:*` 는 본 규약 범위 밖")에 따라 별도 인벤토리 등재
  의무도 없다 — 새 명명 도입이 아니다.
- **`migrations.md` 비저촉**: target 은 새 `V<N>` 마이그레이션을 추가하지 않고, V063 SQL 주석의
  오기(`TriggersService.delete()`)를 "Flyway checksum 때문에 고치지 않는다"(트래커 기존 처분)로 그대로
  유지한다 — §3 Append-only 원칙과 정확히 부합.
- **표 구조**: S1(`1-workflow-list.md` 목록 액션 표, 2열)·S7(`12-workspace.md §2.1` 매핑 표, 4열)·
  S8(`1-data-model.md` 컬럼 표, 3열) 모두 대상 표의 기존 열 수·용법과 일치.
- **API 문서/DTO 규약(Swagger) — 해당 없음**: 이 draft 는 컨트롤러·DTO·API 응답 스키마를 변경하지
  않는다(구현은 별도 developer PR `T2` 로 명시 위임). 따라서 `swagger.md`/`error-codes.md`(데코레이터·
  DTO 명명·응답 포맷 규약)는 이번 diff 범위에 적용 대상이 없다.

## 요약

target 은 1차 `--spec` BLOCK 이 지적한 "규약 문서 내부 자기모순"을 `secret-store.md` 안의 「Trigger
삭제」전제 4개 자리(§2.1 표·§5.3 예시·§6 두 문단·§R4)를 전수 확인 가능한 범위에서 모두 정정해
닫았고, frontmatter 스키마·pending_plans 실존·데이터플로 문서의 인라인 표기 관례·앵커 슬러그·감사
액션 명명·Redis/BullMQ 명명·마이그레이션 append-only 원칙 등 점검한 모든 정식 규약 축에서 위반을
찾지 못했다. 유일한 지적은 S10 frontmatter 지시문의 표현이 "신규 필드 추가"를 "기존 필드에 추가"처럼
읽히게 하는 문구상의 모호함(INFO)뿐이며, 이는 규약 위반이 아니라 실행 시 오독 방지를 위한 표현
개선 제안이다.

## 위험도

NONE
