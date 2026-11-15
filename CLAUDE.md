# 작업 규칙

## 합치기: PR 없이 master에 바로

저장소 주인이 허락했어요: 작업이 끝나면 **PR을 만들지 말고 `master`에 바로 합쳐요.**
(`master`에 푸시하면 GitHub Actions가 테스트·빌드를 거쳐 GitHub Pages에 배포해요.)

1. 작업 브랜치에서 커밋해요.
2. `git fetch origin master && git rebase origin/master` 로 최신 `master` 위에 올려요.
3. 합치기 전에 모두 통과하는지 확인해요:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
4. `git push origin HEAD:master` 로 푸시해요. (작업 브랜치도 함께 푸시해 둬요.)
5. GitHub Actions의 ‘빌드 및 배포’ 실행이 성공했는지(Pages 배포까지) 확인하고 알려 줘요.
   실패하면 원인을 찾아 고치고 다시 합쳐요.

PR은 저장소 주인이 따로 부탁할 때만 만들어요.
