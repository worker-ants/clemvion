# Rationale 연속성 검토 — `plan/in-progress/column-guard-gaps.md` (target: `spec/1-data-model.md`)

## 스코프 정정 확인

프롬프트 번들의 `scope=spec/2-navigation/` 는 (harness 의 선례를 따른) 우회 경로이고, 프롬프트 하단
"(main 추가)" 블록이 명시하듯 이 구현이 실제로 따르는 spec 은 `spec/1-data-model.md` 다. 본 검토는 그 지시에
따라 `spec/1-data-model.md`(frontmatter `code:` · §2.16 ModelConfig · §2.20 AssistantSession · `## Rationale`)와
plan `plan/in-progress/column-guard-gaps.md`, 그리고 그 트래커 원문(`plan/in-progress/spec-draft-nullable-notation-followups.md`
"컬럼 층 가드의 남은 빈칸")·선행 plan(`plan/complete/entity-column-declaration-drift.md`)·그 4라운드 리뷰
(`review/code/2026/09/19/17_04_28` · `17_25_09` · `17_45_35` · `18_07_01`)를 직접 읽어 대조했다. `spec/2-navigation/`
자체의 본문·Rationale은 이번 구현과 무관해 대조에서 제외했다(2-navigation 내부의 자기-정합성은 별도로 훑었으나
이 target 과 관련된 충돌은 없었다 — R-2 폐기 표기·R-17 캐너리 한계 서술 등 기존 결정 번복 처리 패턴은 모두
정상적으로 취소선/정정 표기를 갖추고 있었다).

## 발견사항

없음.

검토한 세 축 모두 기존 Rationale 과 정합했다:

1. **`code:` 전용 e2e 가드 셋 원칙 (`1-data-model.md` Rationale "`code:` 에 전용 e2e 가드 셋 (2026-09-19)")** —
   "인덱스·제약은 선언→DB 한쪽, 컬럼 정의는 양방향" 이라는 명시된 비대칭을 plan 이 뒤집지 않는다. plan 은
   기존 `entity-schema-declarations.e2e-spec.ts` 한 파일 안에서만 테스트를 늘리고, 새 전용 가드 파일을
   `code:` 에 추가하지 않는다 — "새 전용 가드는 드물게 생긴다" 는 같은 Rationale 의 원칙과 부합한다.
2. **읽기 전용 세션 "예방" 테스트 신설** — 트래커 원문(`spec-draft-nullable-notation-followups.md` 4892~4899행)이
   "같은 `DataSource` 로 `CREATE TEMP TABLE` 을 시도해 read-only 거부를 단언하는 `it` 하나면 된다" 고 이미 좁게
   scope 를 확정해 두었고, plan 의 항목 1 은 그 문장을 그대로 구현 계획으로 옮긴 것이다. 실측으로도 확인했다 —
   Postgres 18(`pgvector/pgvector:pg18`, 이 저장소가 쓰는 것과 동일 이미지)에서 `default_transaction_read_only=on`
   세션은 영구 테이블뿐 아니라 `CREATE TEMP TABLE` 도 `ERROR: cannot execute CREATE TABLE in a read-only
   transaction` 로 거부한다(scratch DB 로 직접 재현, 정리 완료) — plan 의 "성공해도 임시라 무해" 전제가 아니라
   "애초에 성공하지 않는다" 는 더 강한 사실이 plan 의 결론(거부를 단언)과 일치한다.
   - 참고로 이 새 테스트는 round-3 가 발견한 **또 다른** 조용한 실패(`initialize()` 의 `CREATE EXTENSION`
     시도가 읽기 전용 세션에서 조용히 삼켜지던 것 → `installExtensions: false` 로 봉합, `entity-column-
     declaration-drift.md` 87~90행)까지 회귀 방지하지는 않는다 — `installExtensions: false` 만 지워지는
     시나리오는 read-only 차단 자체와 무관해 `CREATE TEMP TABLE` 단언이 RED 로 못 잡는다. 다만 이것은 새로
     발견한 갭이 아니라 트래커 원문이 "하나면 된다" 로 **이미 명시적으로 좁혀 둔 scope 밖**이다(round-4 리뷰
     `18_07_01/testing.md` 도 이를 INFO 로 남기며 "조치 불요에 가깝다" 로 판정했다) — 재지적하지 않는다.
3. **`default` RETURNING 왕복 테스트** — `entity-column-declaration-drift.md` 의 "런타임 영향" 절이 "e2e 전체로
   확인한다" 고 적었던 것을, round-4 리뷰(`18_07_01/testing.md` INFO)가 "안전망이 실제로 작동함을 겨냥한 좁은
   통합 테스트" 로 승격을 제안했고 plan 의 항목 2 가 그대로 따른다. `spec/1-data-model.md` §2.16(`kind` default=
   `'chat'`, V088)·§2.20(`last_interaction_at` default=`now()`)의 서술과도 일치하며, "다른 컬럼의 기본값 왕복은
   비대상" 이라는 plan 의 스코프 제한도 트래커가 짚은 두 컬럼(이번 컬럼 정정 라운드에서 새로 선언한 것)에만
   한정한다는 점에서 과잉 확장이 아니다.

## 요약

`plan/in-progress/column-guard-gaps.md` 는 새로운 설계 결정을 도입하지 않고, `plan/complete/entity-column-
declaration-drift.md` 4라운드 리뷰가 남긴 "수렴 예외"(예방 계층 자체의 회귀 테스트 부재·`default` RETURNING
왕복 미검증)를 트래커가 이미 정한 좁은 scope 그대로 닫는 후속 작업이다. `spec/1-data-model.md` 의 "`code:` 에
전용 e2e 가드 셋" Rationale 이 규정한 "인덱스·제약은 단방향, 컬럼은 양방향" 비대칭이나 "기능 e2e 를 넣지 않는다"
원칙을 건드리지 않고, 기각된 대안을 재도입하지도, 과거 결정을 무근거로 번복하지도 않는다. Postgres 의 읽기
전용 트랜잭션이 임시 테이블 생성도 거부한다는 plan 의 핵심 기술 전제는 실측(pg18)으로 재확인했다. Rationale
연속성 관점에서 차단 사유가 없다.

## 위험도

NONE
