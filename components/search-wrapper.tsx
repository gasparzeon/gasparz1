import { getAllPosts, getAllTags } from '@/lib/content'
import { SearchDialog } from '@/components/search-dialog'

export async function SearchWrapper() {
  const [posts, tags] = await Promise.all([
    getAllPosts(),
    getAllTags(),
  ])

  return <SearchDialog posts={posts} tags={tags} />
}
