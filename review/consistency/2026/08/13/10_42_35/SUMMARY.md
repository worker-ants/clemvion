# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — 5개 checker 전원이 위험도 NONE 을 보고했으며 CRITICAL/WARNING 위배를 찾지 못했다.

## 검토 대상 요약

`origin/main...HEAD` 실측 diff 기준, 이번 changeset 은 EIA 멱등성 캐시(`IdempotencyInterceptor`)의
Redis fail-open 강등 다섯 경로에 `clemvion.redis.fail_open` OTel Counter 계측을 추가하는 좁은 범위의
관측성(observability) 변경이다. spec 변경은 `spec/5-system/_product-overview.md`(NF-OB-07 카탈로그
행 추가)와 `spec/data-flow/9-observability.md`(미러 문장 + Rationale 신규 소절)뿐이며,
`spec/5-system/14-external-interaction-api.md` §R8 캐시 키 스코프 자체는 이번 diff 로 변경되지
않았다(브랜치명과 달리 §R8 정합화는 선행 커밋으로 이미 완료·병합됨). 5개 checker 전원이 prompt
번들의 컨텍스트 예산 초과로 target/diff 본문이 절단됐음을 인지하고, 워크트리에서 `git diff` 를
직접 재실행해 실제 변경 범위를 재구성한 뒤 검토를 수행했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 라벨 키 `component` 가 `spec/conventions/user-guide-evidence.md:60` 표 컬럼명 `component` 와 문자열 동일 | `clemvion.redis.fail_open` 라벨 vs user-guide evidence 표 | 도메인이 완전히 분리돼 있어 조치 불요. 참고용 기록만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | NF-OB-07 카탈로그 SoT 단일화 유지, `component`/`reason` 닫힌 라벨이 실제 배선(idempotency 1곳)과 정확히 일치, §R8 캐시 키 스코프 무변경, 계층 책임(`@Optional()` DI 패턴) 기존 관례 준수 |
| rationale_continuity | NONE | fail-open 제어 흐름 불변(관측만 추가), `4-execution-engine.md`·`14-external-interaction-api.md` §R8·`_product-overview.md`(관측 이원화 정책)와 정합. `component` 스코프 축소 근거가 `data-flow/9-observability.md` `## Rationale` 에 명시 기록됨(직전 세션 INFO 갭 해소) |
| convention_compliance | NONE | 라벨 케이스(snake_case)·OTel 이름(dot 표기)·unit 표기·NF-OB-07 표 포맷·frontmatter 적용/제외 대상·redis-keys.md 인벤토리 전부 정합. 신규 Redis 키·API 표면·DTO 변경 없음 |
| plan_coherence | NONE | `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 지시와 target 1:1 대응. 선행 조건 모두 이전 커밋으로 충족. 후속 확장(다른 fail-open 소비자 배선)이 `backend-lint-gate-broken-on-main.md` 에 명시적 미체크 항목+동시 갱신 조건으로 등재됨. 이전 라운드 INFO(plan lifecycle 이동) 해소 확인 |
| naming_collision | NONE | 신규 식별자(메트릭명·타입·메서드·상수·라벨값) 전부 `git grep` 대조로 저장소 전역 유일성 확인. 명명 패턴이 기존 5개 메트릭과 일관 |

## 권장 조치사항

1. (BLOCK 없음 — 조치 불요) 5개 checker 전원 NONE 위험도로 수렴했으며 재작업 대상이 없다.
2. (선택, 비차단) `component` 라벨 키 동명은 기록만 — 기존 카탈로그의 다른 라벨(`status`·`type`·`node_type`)도 범용 단어를 그대로 쓰는 관례와 일관.
3. (참고) 5개 checker 모두 prompt 번들 절단(컨텍스트 예산 초과)을 겪었으나 전원이 워크트리 직접 `git diff` 재실행으로 실제 변경 범위를 재구성해 검토를 완결했다 — 재시도 불요.

---

## 이 라운드 처분 (main Claude)

BLOCK: NO, WARNING 0. INFO 1건은 무조치 — `component` 는 OTel 라벨이고 저쪽은 마크다운 표
컬럼명이라 네임스페이스가 다르다.

**권장 3번은 기록해 둘 값어치가 있다** — 5개 checker 전부가 prompt 번들 절단을 겪었다.
이번엔 전원이 스스로 `git diff` 를 재실행해 복구했지만, 그것은 checker 의 재량이었지 하네스가
보장한 것이 아니다. 절단된 번들을 그대로 읽고 "변경 없음" 으로 판정했으면 조용한 거짓 통과가
됐을 것이다. 예산 문제는 이 저장소에서 반복 관측된 형태(`consistency --spec` 기본 예산이
conventions 를 통째로 떨구는 건)와 같은 뿌리다.

> ⚠️ **이 파일도 한 번 유실됐다** — 작성·커밋을 차단되는 명령에 이어 붙인 탓이다. 같은 실수를
> 이 브랜치에서 두 번(코드 리뷰 SUMMARY, 이 파일) 했다. 게이트에 막히는 명령은 **오직 그
> 명령만** 담아야 한다.
